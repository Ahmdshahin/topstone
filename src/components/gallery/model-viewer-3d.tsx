"use client";

import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment, Bounds, ContactShadows, Html } from "@react-three/drei";
import * as THREE from "three";
import { Maximize, Minimize, RefreshCcw, Loader2, Rotate3D } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelViewer3DProps {
  url: string;
  className?: string;
}

// Sub-component to load and render the actual GLTF/GLB model
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} />;
}

// Sub-component for controlling camera reset
function CameraController({ resetKey }: { resetKey: number }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      camera.position.set(0, 0, 5); // Default safe distance
    }
  }, [resetKey, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={1}
      maxDistance={50}
    />
  );
}

function Loader() {
  return (
    <Html center>
      <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground bg-background/80 p-6 rounded-2xl backdrop-blur-md shadow-sm border border-border">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-medium tracking-tight whitespace-nowrap">Loading 3D Model...</span>
      </div>
    </Html>
  );
}

export function ModelViewer3D({ url, className }: ModelViewer3DProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Preload the model to improve performance
  useEffect(() => {
    useGLTF.preload(url);
  }, [url]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full overflow-hidden bg-gradient-to-b from-muted/30 to-muted/10 border border-border group",
        isFullscreen ? "h-screen rounded-none" : "aspect-square md:aspect-video rounded-xl",
        className
      )}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={["transparent"]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={1} castShadow shadow-bias={-0.0001} />
        
        <Suspense fallback={<Loader />}>
          <Bounds fit clip observe margin={1.2}>
            <Model url={url} />
          </Bounds>
          <Environment preset="city" />
          <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={10} blur={2} far={4} />
        </Suspense>

        <CameraController resetKey={resetKey} />
        
        {/* We mount a separate OrbitControls just for autoRotate if active, 
            or we can just mutate the main controls. The easiest way is conditionally adding another. */}
        {autoRotate && <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} enablePan={false} />}
      </Canvas>

      {/* Control Panel Overlay */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/80 backdrop-blur-md border border-border p-1.5 rounded-full shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
        
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={cn(
            "p-2.5 rounded-full transition-all duration-200",
            autoRotate ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
          title="Auto Rotate"
        >
          <Rotate3D size={18} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onClick={() => setResetKey((k) => k + 1)}
          className="p-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
          title="Reset Camera"
        >
          <RefreshCcw size={18} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onClick={toggleFullscreen}
          className="p-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>

      {/* Helper text for touch/mouse */}
      <div className="absolute top-4 left-4 text-xs font-medium text-muted-foreground bg-background/60 backdrop-blur-md px-3 py-1.5 rounded-full pointer-events-none hidden md:block">
        Scroll to Zoom • Drag to Rotate • Shift+Drag to Pan
      </div>
    </div>
  );
}
