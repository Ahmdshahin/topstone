"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "motion/react";
import { ImageComparison } from "@/components/gallery/image-comparison";
import { PhotoSlider } from "@/components/gallery/photo-slider";
import { cn } from "@/lib/utils";
import { MessageSquare, Download, Calendar, DollarSign, Box, Check, X, Heart, QrCode, ArrowLeft, Globe, Sun, Moon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import dynamic from "next/dynamic";
import { useTranslation } from "@/providers/translation-provider";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

// Dynamically import the heavy WebGL 3D Viewer to prevent blocking initial page load
const ModelViewer3D = dynamic(
  () => import("@/components/gallery/model-viewer-3d").then((mod) => mod.ModelViewer3D),
  { ssr: false, loading: () => <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-secondary/50 rounded-xl animate-pulse text-muted-foreground">Loading 3D Engine...</div> }
);

export interface PresentationData {
  title: string;
  clientName: string;
  heroImage: string;
  description: string;
  beforeImage: string;
  afterImage: string;
  beforeImages?: string[];
  afterImages?: string[];
  model3dUrl: string;
  price: string;
  timeline: string;
  materials: {
    id: string;
    name: string;
    image_url?: string;
    description?: string;
    size?: string;
    color?: string;
    category?: string;
  }[];
  views: number;
}
export function PresentationView({ 
  data, 
  isOwner = false, 
  projectId, 
  designId, 
  lang = "en",
  fromGallery = false
}: { 
  data: PresentationData,
  isOwner?: boolean,
  projectId?: string,
  designId?: string,
  lang?: string,
  fromGallery?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Suppress unused warnings
  useEffect(() => {
    if (isOwner) console.debug("Owner view", projectId, designId);
  }, [isOwner, projectId, designId]);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const { dict } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [hasLiked, setHasLiked] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [status, setStatus] = useState<"pending" | "approved" | "revision">("pending");
  const [currentUrl, setCurrentUrl] = useState("");

  const toggleLanguage = () => {
    const nextLang = lang === 'ar' ? 'en' : 'ar';
    window.location.href = window.location.href.replace(`/${lang}/`, `/${nextLang}/`);
  };

  useEffect(() => {
    setCurrentUrl(window.location.href);
    
    // Simulate tracking a view by logging. 
    // In production, this would call a server action mapped to Supabase RPC `increment_presentation_views`
    console.log("View tracked. Total views:", data.views + 1);
  }, [data.views]);

  const handleApprove = async () => {
    setStatus("approved");
    // Dynamically load confetti only when needed
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#000', '#fff', '#888']
    });
  };

  const handleLike = async () => {
    setHasLiked(!hasLiked);
    if (!hasLiked) {
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 30,
        spread: 40,
        origin: { y: 0.9 },
        colors: ['#ef4444']
      });
    }
  };

  const heroY = useTransform(scrollYProgress, [0, 0.2], ["0%", "50%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  const fadeInUp: any = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
  };

  return (
    <div ref={containerRef} className="relative bg-background text-foreground min-h-screen font-sans selection:bg-primary selection:text-primary-foreground pb-32">
      
      {/* ─── FLOATING TOP CONTROLS ─── */}
      <div className="fixed top-6 right-6 z-50 flex items-center gap-2">
        <Button 
          variant="outline" 
          onClick={toggleLanguage}
          className="bg-black/50 backdrop-blur-md border-white/20 text-white hover:bg-black/70 hover:text-white rounded-full font-medium"
        >
          <Globe className="w-4 h-4 mr-2" />
          {lang === 'ar' ? 'En' : 'عربي'}
        </Button>
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="bg-black/50 backdrop-blur-md border-white/20 text-white hover:bg-black/70 hover:text-white rounded-full"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>

      {fromGallery && (
        <div className="fixed top-6 left-6 z-50">
          <Link href={`/${lang}/gallery`} className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/20 text-white px-5 py-2.5 rounded-full shadow-lg hover:bg-black/70 transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            {dict.gallery?.backToGallery || "Back to Gallery"}
          </Link>
        </div>
      )}

      {/* ─── HERO SECTION ─── */}
      <section className="relative h-screen w-full overflow-hidden flex items-center justify-center">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 w-full h-full">
          <Image
            src={data.heroImage}
            alt={data.title}
            fill
            className="object-cover brightness-[0.6] dark:brightness-[0.4]"
            priority
            sizes="100vw"
          />
        </motion.div>
        
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-5xl mx-auto mt-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium tracking-wide uppercase mb-8"
          >
            {dict.presentation?.clientPresentation || "Client Presentation"}
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="text-5xl md:text-7xl lg:text-8xl font-light tracking-tighter text-white mb-6"
          >
            {data.title}
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
            className="text-xl md:text-2xl text-white/80 font-light max-w-3xl"
          >
            {dict.presentation?.preparedFor || "Prepared exclusively for"} <span className="font-medium text-white">{data.clientName}</span>
          </motion.p>
        </div>
      </section>

      {/* ─── EXECUTIVE SUMMARY ─── */}
      <section className="py-24 md:py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <motion.div 
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInUp}
          className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8"
        >
          <div className="md:col-span-2">
            <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-8">{dict.presentation?.vision || "The Vision"}</h2>
            <p className="text-lg md:text-2xl leading-relaxed text-muted-foreground font-light">
              {data.description}
            </p>
          </div>
          <div className="flex flex-col gap-8 border-l border-border pl-8">
            <div>
              <div className="flex items-center gap-3 text-muted-foreground mb-2">
                <Calendar className="w-5 h-5" />
                <h3 className="text-sm font-medium uppercase tracking-wider">{dict.presentation?.timeline || "Timeline"}</h3>
              </div>
              <p className="text-2xl md:text-3xl font-light">{data.timeline}</p>
            </div>
            <div>
              <div className="flex items-center gap-3 text-muted-foreground mb-2">
                <DollarSign className="w-5 h-5" />
                <h3 className="text-sm font-medium uppercase tracking-wider">{dict.presentation?.price || "Investment"}</h3>
              </div>
              <p className="text-2xl md:text-3xl font-light">{data.price}</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── BEFORE PHOTOS GALLERY ─── */}
      {data.beforeImages && data.beforeImages.length > 0 && (
        <section className="py-12 md:py-24 px-6 md:px-12">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="max-w-7xl mx-auto">
            <PhotoSlider 
              images={data.beforeImages} 
              title={dict.presentation?.siteDocumentation || "Site Documentation"} 
              description={dict.presentation?.siteDesc || "Current state of the structure prior to any interventions."}
            />
          </motion.div>
        </section>
      )}

      {/* ─── MATERIALS ─── */}
      {data.materials && data.materials.length > 0 && (
        <section className="py-24 md:py-32 px-6 md:px-12 bg-secondary/50">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="mb-16">
            <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-4">{dict.presentation?.materialsTitle || "Selected Materials"}</h2>
            <p className="text-lg text-muted-foreground">{dict.presentation?.materialsDesc || "Premium finishes curated for this project."}</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
            {data.materials.map((material, idx) => (
              <motion.div key={material.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: idx * 0.15 }} className="group">
                <div className="relative aspect-square rounded-xl overflow-hidden mb-6 bg-secondary flex items-center justify-center">
                  {material.image_url ? (
                    <Image
                      src={material.image_url}
                      alt={material.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 33vw"
                    />
                  ) : (
                    <Box className="w-12 h-12 text-muted-foreground opacity-20" />
                  )}
                </div>
                <h3 className="text-2xl font-medium mb-2">{material.name}</h3>
                {(material.size || material.color) && (
                  <div className="flex gap-3 mb-3 text-sm">
                    {material.size && <span className="px-2 py-1 bg-secondary/50 rounded-md text-muted-foreground uppercase text-[10px] tracking-wider">Size: {material.size}</span>}
                    {material.color && <span className="px-2 py-1 bg-secondary/50 rounded-md text-muted-foreground uppercase text-[10px] tracking-wider">Color: {material.color}</span>}
                  </div>
                )}
                <p className="text-muted-foreground leading-relaxed font-light">{material.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ─── BEFORE & AFTER COMPARISON ─── */}
      {data.beforeImage && data.afterImage && (
        <section className="py-12 md:py-24 px-6 md:px-12 bg-secondary/30">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-4">{dict.presentation?.transformation || "Transformation"}</h2>
              <p className="text-lg text-muted-foreground">{dict.presentation?.transformationDesc || "Slide to compare the existing structure with the proposed facade."}</p>
            </div>
            <div className="shadow-2xl rounded-2xl overflow-hidden ring-1 ring-border">
              <ImageComparison 
                beforeImage={data.beforeImage} 
                afterImage={data.afterImage} 
                beforeLabel={dict.presentation?.existing || "Existing"}
                afterLabel={dict.presentation?.proposed || "Proposed Render"}
                className="w-full aspect-[4/3] md:aspect-[21/9]"
              />
            </div>
          </motion.div>
        </section>
      )}

      {/* ─── AFTER PHOTOS GALLERY ─── */}
      {data.afterImages && data.afterImages.length > 0 && (
        <section className="py-12 md:py-24 px-6 md:px-12">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="max-w-7xl mx-auto">
            <PhotoSlider 
              images={data.afterImages} 
              title={dict.presentation?.proposedPerspectives || "Proposed Perspectives"} 
              description={dict.presentation?.proposedDesc || "Additional high-quality renders and design angles."}
            />
          </motion.div>
        </section>
      )}

      {/* ─── 3D MODEL ─── */}
      {data.model3dUrl && (
        <section className="py-24 md:py-32 px-6 md:px-12">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp} className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-4">{dict.presentation?.interactiveModel || "Interactive 3D Model"}</h2>
              <p className="text-lg text-muted-foreground">{dict.presentation?.interactiveDesc || "Explore the facade details from every angle."}</p>
            </div>
          </div>
          <div className="shadow-2xl rounded-2xl overflow-hidden ring-1 ring-border bg-gradient-to-br from-background to-secondary/20">
            <ModelViewer3D url={data.model3dUrl} className="w-full h-[60vh] md:h-[80vh] border-none" />
          </div>
        </motion.div>
      </section>
      )}

      {/* ─── COMMENTS SECTION ─── */}
      <section className="py-24 md:py-32 px-6 md:px-12 max-w-4xl mx-auto">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}>
          <div className="flex items-center gap-3 mb-8 border-b border-border pb-6">
            <MessageSquare className="w-6 h-6 text-muted-foreground" />
            <h2 className="text-2xl md:text-3xl font-light tracking-tight">{dict.presentation?.comments || "Client Feedback"}</h2>
          </div>
          <div className="bg-secondary/30 rounded-xl p-6 md:p-8 flex flex-col gap-4">
            <textarea 
              placeholder={dict.presentation?.addComment || "Add your comments or questions about the design here..."}
              className="w-full bg-background border border-border rounded-lg p-4 min-h-[120px] focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            />
            <div className="flex justify-end">
              <button className="bg-primary text-primary-foreground px-6 py-2 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
                {dict.presentation?.postComment || "Post Comment"}
              </button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── CLIENT FLOATING ACTION BAR ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-6 pointer-events-none flex justify-center">
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 2, duration: 0.8, type: "spring" }}
          className="pointer-events-auto flex items-center gap-2 bg-background/90 backdrop-blur-xl border border-border shadow-2xl rounded-full p-2"
        >
          {status === "pending" ? (
            <>
              <button onClick={() => setStatus("revision")} className="flex items-center gap-2 hover:bg-muted text-muted-foreground transition-colors px-4 py-3 rounded-full text-sm font-medium">
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Request Revision</span>
              </button>
              <button onClick={handleApprove} className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors px-6 py-3 rounded-full text-sm font-medium shadow-sm">
                <Check className="w-4 h-4" />
                Approve Design
              </button>
            </>
          ) : status === "approved" ? (
            <div className="flex items-center gap-2 px-6 py-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-sm font-medium">
              <Check className="w-5 h-5" />
              Design Approved
            </div>
          ) : (
            <div className="flex items-center gap-2 px-6 py-3 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full text-sm font-medium">
              <MessageSquare className="w-5 h-5" />
              Revision Requested
            </div>
          )}

          <div className="w-px h-8 bg-border mx-2" />

          <button aria-label={hasLiked ? "Unlike project" : "Like project"} onClick={handleLike} className={cn("flex items-center justify-center w-12 h-12 transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-primary", hasLiked ? "bg-red-500/10 text-red-500" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}>
            <Heart className="w-5 h-5" fill={hasLiked ? "currentColor" : "none"} />
          </button>
          
          <button aria-label="Toggle QR Code sharing" aria-expanded={showQR} onClick={() => setShowQR(!showQR)} className="flex items-center justify-center w-12 h-12 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-primary" title="Share via QR">
            <QrCode className="w-5 h-5" />
          </button>

          <button aria-label="Download presentation as PDF" onClick={() => window.print()} className="flex items-center justify-center w-12 h-12 bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-primary" title="Download PDF">
            <Download className="w-5 h-5" />
          </button>
        </motion.div>

        {/* QR Code Popover */}
        {showQR && currentUrl && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute bottom-24 right-1/2 translate-x-1/2 sm:translate-x-0 sm:right-auto sm:left-auto pointer-events-auto bg-white p-4 rounded-2xl shadow-xl border border-zinc-200"
          >
            <QRCodeSVG value={currentUrl} size={150} level="Q" includeMargin />
            <p className="text-center text-xs text-zinc-500 font-medium mt-3">Scan to view on mobile</p>
          </motion.div>
        )}
      </div>

    </div>
  );
}
