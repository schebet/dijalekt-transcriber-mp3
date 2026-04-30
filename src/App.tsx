/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  FileAudio, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Languages, 
  BookOpen, 
  MapPin,
  ChevronRight,
  RefreshCcw,
  Volume2,
  Download,
  FileText
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Dialect Result Interface
interface DialectWord {
  word: string;
  standard: string;
  meaning: string;
  region?: string;
  context?: string;
}

interface AnalysisResult {
  detectedWords: DialectWord[];
  summary: string;
  identifiedDialect?: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile && selectedFile.type.startsWith('audio/')) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    } else {
      setError('Molimo otpremite validan mp3 ili audio fajl.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'] },
    multiple: false,
    useFsAccessApi: false,
  } as any);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const analyzeAudio = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const base64Data = await fileToBase64(file);

      const prompt = `Analiziraj ovaj audio snimak na srpskom jeziku. Tvoj zadatak je da pronađeš reči, izraze ili gramatičke konstrukcije koje su karakteristične za specifične dijalekte (npr. torlački, prizrensko-timočki, vojvođanski, šumadijsko-raški, crnogorski lokalizmi, arhaizmi, itd.).

Odgovori striktno u JSON formatu sa sledećom strukturom:
{
  "summary": "Kratak opis (2-3 rečenice) o tome koji je dijalekat prepoznat i opšti utisak.",
  "identifiedDialect": "Naziv prepoznatog dijalekta ili regije",
  "detectedWords": [
    {
      "word": "reč iz dijalekta",
      "standard": "ekvivalent u književnom srpskom jeziku",
      "meaning": "objašnjenje značenja",
      "region": "regija iz koje potiče (opciono)",
      "context": "kontekst u kom je upotrebljena (opciono)"
    }
  ]
}

Budi veoma precizan. Ako nema izrazitih dijalektizama, navedi kolokvijalizme ili specifične akcente.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType: file.type, data: base64Data } }
            ]
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const text = response.text;
      if (!text) throw new Error('Model nije vratio odgovor.');
      
      const parsedResult: AnalysisResult = JSON.parse(text);
      setResult(parsedResult);
    } catch (err) {
      console.error(err);
      setError('Došlo je do greške prilikom analize. Molimo pokušajte ponovo.');
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const exportToTxt = () => {
    if (!result || !file) return;

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const fileName = `${baseName} - dijalekt detektor.txt`;

    let content = `DIJALEKAT DETEKTOR - REZULTATI ANALIZE\n`;
    content += `======================================\n\n`;
    content += `ORIGINALNI FAJL: ${file.name}\n`;
    content += `DIJALEKAT: ${result.identifiedDialect || 'Nije specificirano'}\n\n`;
    content += `REZIME: ${result.summary}\n\n`;
    content += `PRONAĐENI DIJALEKTIZMI (${result.detectedWords.length}):\n`;
    content += `--------------------------------------\n`;

    result.detectedWords.forEach((w, i) => {
      content += `${i + 1}. REČ: ${w.word}\n`;
      content += `   STANDARDNO: ${w.standard}\n`;
      content += `   ZNAČENJE: ${w.meaning}\n`;
      if (w.region) content += `   REGIJA: ${w.region}\n`;
      if (w.context) content += `   KONTEKST: "${w.context}"\n`;
      content += `\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToPdf = () => {
    if (!result || !file) return;

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    const fileName = `${baseName} - dijalekt detektor.pdf`;

    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(20);
    doc.text('Dijalekat Detektor - Rezultati', 20, y);
    y += 15;

    doc.setFontSize(12);
    doc.text(`Dijalekat: ${result.identifiedDialect || 'Nije specificirano'}`, 20, y);
    y += 10;

    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(`Rezime: ${result.summary}`, 170);
    doc.text(summaryLines, 20, y);
    y += summaryLines.length * 5 + 10;

    doc.setFontSize(14);
    doc.text('Pronađeni dijalektizmi:', 20, y);
    y += 10;

    result.detectedWords.forEach((w, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${i + 1}. ${w.word} (${w.standard})`, 20, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const meaningLines = doc.splitTextToSize(`Značenje: ${w.meaning}`, 160);
      doc.text(meaningLines, 25, y);
      y += meaningLines.length * 5;
      
      if (w.region) {
        doc.text(`Regija: ${w.region}`, 25, y);
        y += 5;
      }
      y += 5;
    });

    doc.save(fileName);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-[#5A5A40] selection:text-white">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-10">
        <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-[#5A5A40] filter blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30vw] h-[30vw] rounded-full bg-[#C1C1A4] filter blur-[80px]" />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 lg:py-24">
        {/* Header */}
        <header className="mb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-serif font-light mb-4 tracking-tight">
              Dijalekat <span className="italic">Detektor</span>
            </h1>
            <p className="text-[#5A5A40] text-lg font-medium tracking-wide uppercase text-sm">
              Čuvar jezičkog nasleđa Srbije
            </p>
          </motion.div>
        </header>

        <section className="space-y-8">
          {!result ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "p-8 rounded-[32px] bg-white shadow-xl shadow-[#00000008] border border-[#00000005]",
                "flex flex-col items-center justify-center min-h-[400px] transition-all duration-300"
              )}
            >
              {!file ? (
                <div 
                  {...getRootProps()} 
                  className={cn(
                    "w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 cursor-pointer transition-colors group",
                    isDragActive ? "border-[#5A5A40] bg-[#F5F5F0]" : "border-[#E5E5E0] hover:border-[#5A5A40]"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className="w-16 h-16 bg-[#F5F5F0] rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-[#5A5A40]" />
                  </div>
                  <h3 className="text-xl font-serif mb-2">Otpremi audio snimak</h3>
                  <p className="text-[#8E8E8E] text-center max-w-sm">
                    Prevucite MP3 fajl ovde ili kliknite da izaberete iz vašeg uređaja
                  </p>
                </div>
              ) : (
                <div className="w-full text-center space-y-8">
                  <div className="flex items-center justify-center space-x-4 p-6 bg-[#F5F5F0] rounded-2xl border border-[#E5E5E0]">
                    <FileAudio className="w-10 h-10 text-[#5A5A40]" />
                    <div className="text-left">
                      <p className="font-medium truncate max-w-[200px] md:max-w-md">{file.name}</p>
                      <p className="text-xs text-[#8E8E8E]">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                    <button 
                      onClick={() => setFile(null)}
                      className="p-2 hover:bg-white rounded-full transition-colors"
                    >
                      <RefreshCcw className="w-4 h-4 text-[#8E8E8E]" />
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-center justify-center space-x-2 text-red-600 bg-red-50 p-4 rounded-xl">
                      <AlertCircle className="w-5 h-5" />
                      <span className="text-sm">{error}</span>
                    </div>
                  )}

                  <button
                    onClick={analyzeAudio}
                    disabled={isUploading}
                    className={cn(
                      "w-64 py-4 rounded-full bg-[#5A5A40] text-white font-medium shadow-lg shadow-[#5A5A4033] hover:translate-y-[-2px] active:translate-y-[0] transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:translate-y-0"
                    )}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Analiziram...</span>
                      </>
                    ) : (
                      <>
                        <Languages className="w-5 h-5" />
                        <span>Započni Analizu</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Summary Card */}
              <div className="p-8 rounded-[32px] bg-white shadow-xl border border-[#00000005] overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <BookOpen className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center space-x-3 mb-6">
                    <div className="w-10 h-10 bg-[#F5F5F0] rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-[#5A5A40]" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-serif">Rezultati Analize</h2>
                      <p className="text-xs text-[#5A5A40] uppercase tracking-widest">{result.identifiedDialect || "Specifičan govor"}</p>
                    </div>
                  </div>
                  <p className="text-lg text-[#4A4A4A] leading-relaxed italic mb-8">
                    "{result.summary}"
                  </p>
                  
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={exportToTxt}
                      className="px-4 py-2 rounded-full bg-[#F5F5F0] text-[#5A5A40] text-sm font-medium hover:bg-[#5A5A40] hover:text-white transition-all flex items-center space-x-2"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Izvezi u TXT</span>
                    </button>
                    <button 
                      onClick={exportToPdf}
                      className="px-4 py-2 rounded-full bg-[#F5F5F0] text-[#5A5A40] text-sm font-medium hover:bg-[#5A5A40] hover:text-white transition-all flex items-center space-x-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Sačuvaj kao PDF</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Words Feed */}
              <div className="grid gap-6">
                <h3 className="text-sm font-medium uppercase tracking-[0.2em] text-[#8E8E8E] flex items-center">
                  <ChevronRight className="w-4 h-4 mr-1" />
                  Pronađeni dijalektizmi ({result.detectedWords.length})
                </h3>
                
                {result.detectedWords.map((word, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="group"
                  >
                    <div className="p-6 rounded-2xl bg-white border border-[#E5E5E0] hover:border-[#5A5A40] transition-colors shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl font-serif text-[#5A5A40] lowercase">{word.word}</span>
                            <div className="px-2 py-0.5 rounded-md bg-[#F5F5F0] text-[10px] font-bold text-[#5A5A40] uppercase tracking-wider">
                              Lokalizam
                            </div>
                          </div>
                          <div className="flex items-center text-[#8E8E8E] text-sm">
                            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                            <span>Standardno: <strong className="text-[#1A1A1A] font-medium">{word.standard}</strong></span>
                          </div>
                        </div>

                        <div className="flex-1 md:max-w-md">
                          <p className="text-[#4A4A4A] text-sm leading-snug">
                            {word.meaning}
                          </p>
                        </div>

                        <div className="flex items-center space-x-4 border-t md:border-t-0 md:border-l border-[#F5F5F0] pt-4 md:pt-0 md:pl-6">
                          {word.region && (
                            <div className="flex items-center text-[#8E8E8E] text-xs">
                              <MapPin className="w-3.5 h-3.5 mr-1" />
                              {word.region}
                            </div>
                          )}
                          <button className="w-8 h-8 rounded-full bg-[#F5F5F0] flex items-center justify-center hover:bg-[#5A5A40] hover:text-white transition-colors">
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {word.context && (
                        <div className="mt-4 pt-4 border-t border-[#F5F5F0] text-xs text-[#8E8E8E]">
                          <span className="font-semibold uppercase text-[9px] tracking-wider text-[#5A5A40] mr-2">Iz snimka:</span>
                          "{word.context}"
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="pt-8 flex justify-center">
                <button
                  onClick={reset}
                  className="px-8 py-3 rounded-full border border-[#5A5A40] text-[#5A5A40] font-medium hover:bg-[#5A5A40] hover:text-white transition-all flex items-center space-x-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  <span>Nova Analiza</span>
                </button>
              </div>
            </motion.div>
          )}
        </section>

        {/* Info Footer */}
        <footer className="mt-24 pt-12 border-t border-[#E5E5E0] text-center text-[#8E8E8E]">
          <p className="text-sm max-w-lg mx-auto">
            Ovaj alat koristi veštačku inteligenciju za analizu govora i prepoznavanje dijalektizama. 
            Cilj nam je očuvanje bogatstva srpskog jezika u svim njegovim oblicima.
          </p>
          <div className="mt-6 flex justify-center space-x-6 text-xs uppercase tracking-[0.3em]">
            <span>Vojvodina</span>
            <span>Šumadija</span>
            <span>Pomoravlje</span>
            <span>Torlak</span>
          </div>
        </footer>
      </main>
    </div>
  );
}
