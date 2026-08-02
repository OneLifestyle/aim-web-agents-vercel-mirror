import React, { useState, useRef, useEffect } from 'react';
import { colors, typography, spacing, borderRadius } from '../theme';
import { Play, Pause, SkipBack, SkipForward, Type, Image as ImageIcon, Download, Upload as UploadIcon, X, ZoomIn, ZoomOut, MoveHorizontal, ChevronLeft, ChevronRight, Music, Volume2 } from 'lucide-react';
import { PositionRect } from '../components/PositionRect';

interface ImageSlide {
  id: string;
  name: string;
  url: string;
  file?: File;
  duration: number;
  kenBurns?: {
    effect: 'zoomIn' | 'zoomOut' | 'panLeft' | 'panRight' | 'none';
    startScale: number;
    endScale: number;
    // Position data for visual editing (percentage offsets from center)
    startOffsetX?: number; // -10 to 10
    startOffsetY?: number; // -10 to 10
    endOffsetX?: number; // -10 to 10
    endOffsetY?: number; // -10 to 10
  };
}

type KenBurnsEffect = NonNullable<ImageSlide['kenBurns']>['effect'];
type KenBurnsSettings = Omit<NonNullable<ImageSlide['kenBurns']>, 'effect'>;

interface Overlay {
  id: string;
  type: 'address' | 'price' | 'custom';
  text: string;
  startTime: number;
  duration: number;
}

interface EndCard {
  enabled: boolean;
  agentName: string;
  phone: string;
  email: string;
  agencyName: string;
  brokerageLogo?: string;
  logoFile?: File;
}

interface AudioTrack {
  id: string;
  name: string;
  url: string;
  file?: File;
  type: 'music' | 'voiceover';
  duration: number;
  startTime: number;
}

export const VideoEditorPage: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [slides, setSlides] = useState<ImageSlide[]>([]);
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [selectedSlide, setSelectedSlide] = useState<string | null>(null);
  const [showOverlayPanel, setShowOverlayPanel] = useState(false);
  const [showEndCardPanel, setShowEndCardPanel] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hoveredEffect, setHoveredEffect] = useState<string | null>(null);
  const [showingEndCard, setShowingEndCard] = useState(false);

  // Visual position editing state
  const [selectedPosition, setSelectedPosition] = useState<'start' | 'end'>('start'); // Which position is being edited

  const [endCard, setEndCard] = useState<EndCard>({
    enabled: false,
    agentName: '',
    phone: '',
    email: '',
    agencyName: '',
    brokerageLogo: undefined,
    logoFile: undefined
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const playbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDuration = slides.reduce((sum, slide) => sum + slide.duration, 0);
  const TIMELINE_SCALE = 30; // pixels per second

  // Playback logic
  useEffect(() => {
    if (isPlaying && slides.length > 0) {
      playbackTimerRef.current = setInterval(() => {
        setCurrentTime((prevTime) => {
          const newTime = prevTime + 0.1;

          // Calculate which slide should be showing
          let accumulatedTime = 0;
          let slideIndex = 0;
          for (let i = 0; i < slides.length; i++) {
            if (newTime >= accumulatedTime && newTime < accumulatedTime + slides[i].duration) {
              slideIndex = i;
              break;
            }
            accumulatedTime += slides[i].duration;
          }

          // Check if we've reached the end
          if (newTime >= totalDuration) {
            if (endCard.enabled) {
              setShowingEndCard(true);
              setTimeout(() => {
                setIsPlaying(false);
                setShowingEndCard(false);
                return 0;
              }, 3000);
            } else {
              setIsPlaying(false);
              return 0;
            }
          } else {
            setCurrentSlideIndex(slideIndex);
            setShowingEndCard(false);
          }

          return newTime;
        });
      }, 100);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    }

    return () => {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    };
  }, [isPlaying, slides, totalDuration, endCard.enabled]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const newSlide: ImageSlide = {
            id: Date.now().toString() + Math.random(),
            name: file.name,
            url: URL.createObjectURL(file),
            file: file,
            duration: 3,
            kenBurns: { effect: 'zoomIn', startScale: 100, endScale: 95 }
          };
          setSlides(prev => [...prev, newSlide]);
        }
      });
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      const newAudio: AudioTrack = {
        id: Date.now().toString(),
        name: file.name,
        url: URL.createObjectURL(file),
        file: file,
        type: 'music',
        duration: 10, // In real app, would need to load audio to get actual duration
        startTime: 0
      };
      setAudioTracks([...audioTracks, newAudio]);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setEndCard({
        ...endCard,
        brokerageLogo: URL.createObjectURL(file),
        logoFile: file
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files) {
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          const newSlide: ImageSlide = {
            id: Date.now().toString() + Math.random(),
            name: file.name,
            url: URL.createObjectURL(file),
            file: file,
            duration: 3,
            kenBurns: { effect: 'zoomIn', startScale: 100, endScale: 95 }
          };
          setSlides(prev => [...prev, newSlide]);
        } else if (file.type.startsWith('audio/')) {
          const newAudio: AudioTrack = {
            id: Date.now().toString(),
            name: file.name,
            url: URL.createObjectURL(file),
            file: file,
            type: 'music',
            duration: 10,
            startTime: 0
          };
          setAudioTracks(prev => [...prev, newAudio]);
        }
      });
    }
  };

  const handleRemoveSlide = (id: string) => {
    setSlides(slides.filter(s => s.id !== id));
    if (selectedSlide === id) setSelectedSlide(null);
  };

  const handleRemoveAudio = (id: string) => {
    setAudioTracks(audioTracks.filter(a => a.id !== id));
  };

  const handleUpdateKenBurns = (id: string, effect: KenBurnsEffect) => {
    const defaults: Record<KenBurnsEffect, KenBurnsSettings> = {
      zoomIn: { startScale: 100, endScale: 95, startOffsetX: 0, startOffsetY: 0, endOffsetX: 0, endOffsetY: 0 },
      zoomOut: { startScale: 95, endScale: 100, startOffsetX: 0, startOffsetY: 0, endOffsetX: 0, endOffsetY: 0 },
      panLeft: { startScale: 100, endScale: 100, startOffsetX: 0, startOffsetY: 0, endOffsetX: -5, endOffsetY: 0 },
      panRight: { startScale: 100, endScale: 100, startOffsetX: 0, startOffsetY: 0, endOffsetX: 5, endOffsetY: 0 },
      none: { startScale: 100, endScale: 100, startOffsetX: 0, startOffsetY: 0, endOffsetX: 0, endOffsetY: 0 }
    };
    setSlides(slides.map(s => s.id === id ? { ...s, kenBurns: { effect, ...defaults[effect] } } : s));
  };

  const handleUpdatePosition = (id: string, position: 'start' | 'end', scale: number, offsetX: number, offsetY: number) => {
    setSlides(slides.map(s => {
      if (s.id === id && s.kenBurns) {
        if (position === 'start') {
          return { ...s, kenBurns: { ...s.kenBurns, startScale: scale, startOffsetX: offsetX, startOffsetY: offsetY } };
        } else {
          return { ...s, kenBurns: { ...s.kenBurns, endScale: scale, endOffsetX: offsetX, endOffsetY: offsetY } };
        }
      }
      return s;
    }));
  };

  const handleUpdateKenBurnsParams = (id: string, startScale: number, endScale: number) => {
    setSlides(slides.map(s => {
      if (s.id === id && s.kenBurns) {
        return { ...s, kenBurns: { ...s.kenBurns, startScale, endScale } };
      }
      return s;
    }));
  };

  const handleUpdateDuration = (id: string, duration: number) => {
    setSlides(slides.map(s => s.id === id ? { ...s, duration } : s));
  };

  const handleAddOverlay = (type: Overlay['type'], text: string) => {
    const newOverlay: Overlay = {
      id: Date.now().toString(),
      type,
      text,
      startTime: 0,
      duration: 3
    };
    setOverlays([...overlays, newOverlay]);
  };

  const handlePlayPause = () => {
    if (!isPlaying && slides.length > 0) {
      setIsPlaying(true);
      if (currentTime >= totalDuration) {
        setCurrentTime(0);
        setCurrentSlideIndex(0);
      }
    } else {
      setIsPlaying(false);
    }
  };

  const getEffectAnimation = (effect: string) => {
    switch (effect) {
      case 'zoomIn': return { transform: 'scale(1.05)', transition: 'transform 0.5s ease-in-out' };
      case 'zoomOut': return { transform: 'scale(0.95)', transition: 'transform 0.5s ease-in-out' };
      case 'panLeft': return { transform: 'translateX(-5px)', transition: 'transform 0.5s ease-in-out' };
      case 'panRight': return { transform: 'translateX(5px)', transition: 'transform 0.5s ease-in-out' };
      default: return {};
    }
  };
  const getKenBurnsStyle = (slide: ImageSlide) => {
    if (!slide.kenBurns || !isPlaying) return {};

    // const { effect } = slide.kenBurns; // effect is no longer needed for dynamic style
    const duration = slide.duration;

    // Use dynamic CSS variables for custom animation
    return {
      '--kb-start-scale': (slide.kenBurns.startScale || 100) / 100,
      '--kb-end-scale': (slide.kenBurns.endScale || 100) / 100,
      '--kb-start-x': `${slide.kenBurns.startOffsetX || 0}%`,
      '--kb-start-y': `${slide.kenBurns.startOffsetY || 0}%`,
      '--kb-end-x': `${slide.kenBurns.endOffsetX || 0}%`,
      '--kb-end-y': `${slide.kenBurns.endOffsetY || 0}%`,
      animation: `kenBurnsCustom ${duration}s linear forwards`,
      transformOrigin: 'center center'
    } as React.CSSProperties;
  };

  const currentSlide = slides[currentSlideIndex];
  const activeOverlays = overlays.filter(overlay =>
    currentTime >= overlay.startTime && currentTime < overlay.startTime + overlay.duration
  );

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: colors.background,
      color: colors.text
    }}>
      <style>
        {`
          @keyframes kenBurnsZoomIn {
            from { transform: scale(1); }
            to { transform: scale(0.95); }
          }
          @keyframes kenBurnsZoomOut {
            from { transform: scale(0.95); }
            to { transform: scale(1); }
          }
          @keyframes kenBurnsPanLeft {
            from { transform: translateX(0%) scale(1.05); }
            to { transform: translateX(-5%) scale(1.05); }
          }
          @keyframes kenBurnsPanRight {
            from { transform: translateX(0%) scale(1.05); }
            to { transform: translateX(5%) scale(1.05); }
          }
        `}
      </style>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        onChange={handleLogoSelect}
        style={{ display: 'none' }}
      />
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        onChange={handleAudioSelect}
        style={{ display: 'none' }}
      />

      {/* Header */}
      <header style={{
        height: '60px',
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${spacing.xl}px`,
        justifyContent: 'space-between',
        backgroundColor: colors.surface
      }}>
        <div>
          <h1 style={{ fontSize: typography.fontSize.headline, fontWeight: typography.fontWeight.bold, margin: 0 }}>
            Ken Burns Slideshow
          </h1>
          <p style={{ fontSize: typography.fontSize.caption, color: colors.textSecondary, margin: 0 }}>
            Preview-only recovery baseline • {totalDuration}s • {slides.length} slides
          </p>
        </div>
        <button
          disabled
          title="A project renderer is not connected in this source-recovery baseline."
          style={{
            display: 'flex', alignItems: 'center', gap: `${spacing.sm}px`,
            padding: `${spacing.md}px ${spacing.xl}px`,
            borderRadius: `${borderRadius.lg}px`,
            backgroundColor: colors.textMuted,
            border: 'none',
            color: colors.white,
            cursor: 'not-allowed',
            fontSize: typography.fontSize.callout,
            fontWeight: typography.fontWeight.semibold
          }}
        >
          <Download size={18} />
          MP4 renderer not connected
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar - Collapsible */}
        <aside style={{
          width: sidebarCollapsed ? '60px' : '280px',
          borderRight: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'width 0.3s ease',
          position: 'relative',
          flexShrink: 0
        }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              position: 'absolute',
              top: spacing.md,
              right: spacing.sm,
              background: colors.backgroundSecondary,
              border: `1px solid ${colors.border}`,
              borderRadius: `${borderRadius.sm}px`,
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10
            }}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {!sidebarCollapsed && (
            <>
              <div style={{ padding: spacing.lg, borderBottom: `1px solid ${colors.border}`, paddingTop: spacing['3xl'] }}>
                <h3 style={{ margin: 0, fontSize: typography.fontSize.subheadline, fontWeight: typography.fontWeight.semibold }}>
                  Media Library
                </h3>
                <p style={{ margin: `${spacing.xs}px 0 0`, fontSize: typography.fontSize.caption, color: colors.textSecondary }}>
                  Drag or click to upload
                </p>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: spacing.lg }}>
                {/* Image Upload */}
                <div style={{ marginBottom: spacing.lg }}>
                  <label style={{ display: 'block', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm, color: colors.textSecondary }}>
                    IMAGES
                  </label>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    style={{
                      width: '100%',
                      padding: `${spacing.lg}px`,
                      border: `2px dashed ${colors.border}`,
                      borderRadius: `${borderRadius.lg}px`,
                      backgroundColor: 'transparent',
                      color: colors.textSecondary,
                      cursor: 'pointer',
                      marginBottom: spacing.md,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: spacing.xs
                    }}
                  >
                    <ImageIcon size={24} />
                    <span style={{ fontSize: typography.fontSize.caption }}>Click or drop</span>
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md }}>
                    {slides.map(slide => (
                      <div key={slide.id} style={{
                        aspectRatio: '16/9',
                        backgroundColor: colors.backgroundTertiary,
                        borderRadius: `${borderRadius.md}px`,
                        cursor: 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${colors.border}`,
                        overflow: 'hidden',
                        backgroundImage: slide.url ? `url(${slide.url})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }} />
                    ))}
                  </div>
                </div>

                {/* Audio Upload */}
                <div>
                  <label style={{ display: 'block', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm, color: colors.textSecondary }}>
                    AUDIO REFERENCE — PLAYBACK NOT CONNECTED
                  </label>
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    style={{
                      width: '100%',
                      padding: `${spacing.lg}px`,
                      border: `2px dashed ${colors.border}`,
                      borderRadius: `${borderRadius.lg}px`,
                      backgroundColor: 'transparent',
                      color: colors.textSecondary,
                      cursor: 'pointer',
                      marginBottom: spacing.md,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: spacing.xs
                    }}
                  >
                    <Music size={24} />
                    <span style={{ fontSize: typography.fontSize.caption }}>Click or drop audio reference</span>
                  </button>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                    {audioTracks.map(audio => (
                      <div key={audio.id} style={{
                        padding: spacing.sm,
                        backgroundColor: colors.backgroundTertiary,
                        borderRadius: `${borderRadius.sm}px`,
                        fontSize: typography.fontSize.caption,
                        color: colors.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        border: `1px solid ${colors.border}`
                      }}>
                        <Volume2 size={12} style={{ display: 'inline', marginRight: spacing.xs }} />
                        {audio.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {sidebarCollapsed && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: spacing['5xl'],
              gap: spacing.xl
            }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: spacing.sm,
                  color: colors.text
                }}
                title="Upload Images"
              >
                <ImageIcon size={24} />
              </button>
              <button
                onClick={() => audioInputRef.current?.click()}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: spacing.sm,
                  color: colors.text
                }}
                title="Add audio reference"
              >
                <Music size={24} />
              </button>
              <div style={{
                fontSize: typography.fontSize.caption,
                color: colors.textSecondary,
                textAlign: 'center'
              }}>
                {slides.length + audioTracks.length}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Preview & Controls Section */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.background
          }}>
            {/* Preview Area - FIXED: object-fit cover */}
            <div style={{
              backgroundColor: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.xl,
              height: '300px'
            }}>
              <div style={{
                width: '100%',
                maxWidth: '533px',
                aspectRatio: '16/9',
                backgroundColor: '#1a1a1a',
                borderRadius: `${borderRadius.lg}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${colors.border}`,
                overflow: 'hidden',
                position: 'relative'
              }}>
                {showingEndCard && endCard.enabled ? (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: colors.surface,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: spacing.xl,
                    gap: spacing.md
                  }}>
                    {endCard.brokerageLogo && (
                      <img src={endCard.brokerageLogo} alt="Agency Logo" style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain', marginBottom: spacing.sm }} />
                    )}
                    {endCard.agencyName && (
                      <div style={{ fontSize: typography.fontSize.title3, fontWeight: typography.fontWeight.bold, color: colors.text }}>
                        {endCard.agencyName}
                      </div>
                    )}
                    <div style={{ fontSize: typography.fontSize.title3, fontWeight: typography.fontWeight.bold, color: colors.text }}>
                      {endCard.agentName}
                    </div>
                    <div style={{ fontSize: typography.fontSize.callout, color: colors.textSecondary }}>
                      {endCard.phone}
                    </div>
                    <div style={{ fontSize: typography.fontSize.callout, color: colors.textSecondary }}>
                      {endCard.email}
                    </div>
                  </div>
                ) : currentSlide ? (
                  <>
                    <img
                      key={currentSlide.id}
                      src={currentSlide.url}
                      alt="Preview"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        ...getKenBurnsStyle(currentSlide)
                      }}
                    />

                    {/* Visual Position Editing Overlay - show when selected and not playing */}
                    {selectedSlide && !isPlaying && (() => {
                      const slide = slides.find(s => s.id === selectedSlide);
                      if (slide && slide.kenBurns) {
                        return (
                          <>
                            <PositionRect
                              position="start"
                              scale={slide.kenBurns.startScale}
                              offsetX={slide.kenBurns.startOffsetX || 0}
                              offsetY={slide.kenBurns.startOffsetY || 0}
                              isSelected={selectedPosition === 'start'}
                              onSelect={() => setSelectedPosition('start')}
                              onChange={(scale, offsetX, offsetY) => handleUpdatePosition(selectedSlide, 'start', scale, offsetX, offsetY)}
                            />
                            <PositionRect
                              position="end"
                              scale={slide.kenBurns.endScale}
                              offsetX={slide.kenBurns.endOffsetX || 0}
                              offsetY={slide.kenBurns.endOffsetY || 0}
                              isSelected={selectedPosition === 'end'}
                              onSelect={() => setSelectedPosition('end')}
                              onChange={(scale, offsetX, offsetY) => handleUpdatePosition(selectedSlide, 'end', scale, offsetX, offsetY)}
                            />
                          </>
                        );
                      }
                      return null;
                    })()}

                    {activeOverlays.map(overlay => (
                      <div
                        key={overlay.id}
                        style={{
                          position: 'absolute',
                          bottom: '20px',
                          left: '20px',
                          backgroundColor: 'rgba(0, 0, 0, 0.7)',
                          color: colors.white,
                          padding: `${spacing.sm}px ${spacing.md}px`,
                          borderRadius: `${borderRadius.sm}px`,
                          fontSize: typography.fontSize.callout,
                          fontWeight: typography.fontWeight.semibold
                        }}
                      >
                        {overlay.text}
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <ImageIcon size={32} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
                    <p style={{ color: colors.textSecondary, fontSize: typography.fontSize.footnote }}>
                      16:9 Preview
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Playback Controls */}
            <div style={{
              height: '50px',
              borderTop: `1px solid ${colors.border}`,
              borderBottom: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xl
            }}>
              <button
                onClick={() => {
                  setCurrentTime(0);
                  setCurrentSlideIndex(0);
                  setIsPlaying(false);
                }}
                style={{ background: 'none', border: 'none', color: colors.text, cursor: 'pointer', padding: spacing.sm }}
              >
                <SkipBack size={18} />
              </button>
              <button
                onClick={handlePlayPause}
                disabled={slides.length === 0}
                style={{
                  background: slides.length === 0 ? colors.backgroundTertiary : colors.primary,
                  border: 'none',
                  color: colors.white,
                  cursor: slides.length === 0 ? 'not-allowed' : 'pointer',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: '2px' }} />}
              </button>
              <button
                onClick={() => {
                  if (currentSlideIndex < slides.length - 1) {
                    setCurrentSlideIndex(currentSlideIndex + 1);
                    let accumulatedTime = 0;
                    for (let i = 0; i <= currentSlideIndex + 1; i++) {
                      if (i < currentSlideIndex + 1) {
                        accumulatedTime += slides[i].duration;
                      }
                    }
                    setCurrentTime(accumulatedTime);
                  }
                }}
                style={{ background: 'none', border: 'none', color: colors.text, cursor: 'pointer', padding: spacing.sm }}
              >
                <SkipForward size={18} />
              </button>
              <div style={{ marginLeft: spacing.lg, color: colors.textSecondary, fontSize: typography.fontSize.caption }}>
                {Math.floor(currentTime).toString().padStart(2, '0')}:{Math.floor((currentTime % 1) * 60).toString().padStart(2, '0')} / {Math.floor(totalDuration).toString().padStart(2, '0')}:{Math.floor((totalDuration % 1) * 60).toString().padStart(2, '0')}
              </div>
            </div>

            {/* Ken Burns Controls - Horizontal */}
            {selectedSlide && (
              <div style={{
                padding: spacing.lg,
                backgroundColor: colors.surface,
                borderBottom: `1px solid ${colors.border}`
              }}>
                <div style={{ display: 'flex', gap: spacing.xl, alignItems: 'flex-start' }}>
                  {/* Effect Presets */}
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm, color: colors.textSecondary }}>
                      KEN BURNS PREVIEW — DONOR MATH, NOT EXPORT-READY
                    </label>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                      {(['zoomIn', 'zoomOut', 'panLeft', 'panRight'] as const).map(effect => {
                        const slide = slides.find(s => s.id === selectedSlide);
                        const isActive = slide?.kenBurns?.effect === effect;
                        const isHovered = hoveredEffect === effect;
                        return (
                          <button
                            key={effect}
                            onClick={() => handleUpdateKenBurns(selectedSlide, effect)}
                            onMouseEnter={() => setHoveredEffect(effect)}
                            onMouseLeave={() => setHoveredEffect(null)}
                            style={{
                              flex: 1,
                              padding: spacing.sm,
                              backgroundColor: isActive ? colors.primary : colors.backgroundSecondary,
                              color: isActive ? colors.white : colors.text,
                              border: `1px solid ${isActive ? colors.primary : colors.border}`,
                              borderRadius: `${borderRadius.md}px`,
                              cursor: 'pointer',
                              fontSize: typography.fontSize.caption,
                              fontWeight: typography.fontWeight.medium,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: spacing.xs / 2
                            }}
                          >
                            <div style={isHovered ? getEffectAnimation(effect) : {}}>
                              {effect === 'zoomIn' && <ZoomIn size={16} />}
                              {effect === 'zoomOut' && <ZoomOut size={16} />}
                              {effect === 'panLeft' && <MoveHorizontal size={16} />}
                              {effect === 'panRight' && <MoveHorizontal size={16} />}
                            </div>
                            <span style={{ fontSize: typography.fontSize.caption }}>
                              {effect === 'zoomIn' && 'Zoom In'}
                              {effect === 'zoomOut' && 'Zoom Out'}
                              {effect === 'panLeft' && 'Pan Left'}
                              {effect === 'panRight' && 'Pan Right'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Par ameters */}
                  <div style={{ width: '180px' }}>
                    <label style={{ display: 'block', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm, color: colors.textSecondary }}>
                      SCALE %
                    </label>
                    <div style={{ display: 'flex', gap: spacing.sm }}>
                      <input
                        type="number"
                        min="80"
                        max="120"
                        placeholder="Start"
                        value={slides.find(s => s.id === selectedSlide)?.kenBurns?.startScale || 100}
                        onChange={(e) => {
                          const slide = slides.find(s => s.id === selectedSlide);
                          if (slide?.kenBurns) {
                            handleUpdateKenBurnsParams(selectedSlide, parseInt(e.target.value) || 100, slide.kenBurns.endScale);
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: spacing.sm,
                          backgroundColor: colors.backgroundSecondary,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          borderRadius: `${borderRadius.sm}px`,
                          fontSize: typography.fontSize.caption,
                          textAlign: 'center'
                        }}
                      />
                      <input
                        type="number"
                        min="80"
                        max="120"
                        placeholder="End"
                        value={slides.find(s => s.id === selectedSlide)?.kenBurns?.endScale || 100}
                        onChange={(e) => {
                          const slide = slides.find(s => s.id === selectedSlide);
                          if (slide?.kenBurns) {
                            handleUpdateKenBurnsParams(selectedSlide, slide.kenBurns.startScale, parseInt(e.target.value) || 100);
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: spacing.sm,
                          backgroundColor: colors.backgroundSecondary,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          borderRadius: `${borderRadius.sm}px`,
                          fontSize: typography.fontSize.caption,
                          textAlign: 'center'
                        }}
                      />
                    </div>
                  </div>

                  {/* Duration */}
                  <div style={{ width: '120px' }}>
                    <label style={{ display: 'block', fontSize: typography.fontSize.caption, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm, color: colors.textSecondary }}>
                      DURATION
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={slides.find(s => s.id === selectedSlide)?.duration || 3}
                      onChange={(e) => handleUpdateDuration(selectedSlide, parseInt(e.target.value) || 3)}
                      style={{
                        width: '100%',
                        padding: spacing.sm,
                        backgroundColor: colors.backgroundSecondary,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        borderRadius: `${borderRadius.sm}px`,
                        fontSize: typography.fontSize.caption,
                        textAlign: 'center'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Timeline - Full Width with Proportional Widths */}
          <div style={{
            flex: 1,
            backgroundColor: colors.backgroundSecondary,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Timeline Header */}
            <div style={{
              padding: spacing.md,
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.surface
            }}>
              <h3 style={{ margin: 0, fontSize: typography.fontSize.subheadline, fontWeight: typography.fontWeight.semibold }}>
                Timeline
              </h3>
              <div style={{ display: 'flex', gap: spacing.sm }}>
                <button
                  onClick={() => setShowOverlayPanel(!showOverlayPanel)}
                  style={{
                    padding: `${spacing.xs}px ${spacing.md}px`,
                    backgroundColor: showOverlayPanel ? colors.primary : colors.backgroundSecondary,
                    color: showOverlayPanel ? colors.white : colors.text,
                    border: `1px solid ${colors.border}`,
                    borderRadius: `${borderRadius.md}px`,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.caption,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.xs
                  }}
                >
                  <Type size={14} />
                  Add Overlay
                </button>
                <button
                  onClick={() => setShowEndCardPanel(!showEndCardPanel)}
                  style={{
                    padding: `${spacing.xs}px ${spacing.md}px`,
                    backgroundColor: showEndCardPanel ? colors.primary : colors.backgroundSecondary,
                    color: showEndCardPanel ? colors.white : colors.text,
                    border: `1px solid ${colors.border}`,
                    borderRadius: `${borderRadius.md}px`,
                    cursor: 'pointer',
                    fontSize: typography.fontSize.caption
                  }}
                >
                  End Card
                </button>
              </div>
            </div>

            {/* Timeline Tracks */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: spacing.md }}>
              {/* Images Track - FIXED: Proportional widths */}
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <ImageIcon size={14} color={colors.textSecondary} />
                  <h4 style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>
                    IMAGES
                  </h4>
                </div>
                <div style={{
                  minHeight: '80px',
                  backgroundColor: colors.surface,
                  borderRadius: `${borderRadius.md}px`,
                  padding: spacing.sm,
                  border: `1px solid ${colors.border}`,
                  display: 'flex',
                  gap: spacing.xs,
                  alignItems: 'center',
                  overflowX: 'auto'
                }}>
                  {slides.length === 0 ? (
                    <div style={{
                      padding: spacing.md,
                      color: colors.textSecondary,
                      fontSize: typography.fontSize.caption,
                      fontStyle: 'italic'
                    }}>
                      Upload images to get started
                    </div>
                  ) : (
                    slides.map((slide, index) => (
                      <div
                        key={slide.id}
                        onClick={() => {
                          setSelectedSlide(slide.id);
                          setCurrentSlideIndex(index);
                          setCurrentTime(slides.slice(0, index).reduce((sum, item) => sum + item.duration, 0));
                          setIsPlaying(false);
                        }}
                        style={{
                          width: `${slide.duration * TIMELINE_SCALE}px`,
                          minWidth: `${slide.duration * TIMELINE_SCALE}px`,
                          height: '70px',
                          backgroundColor: selectedSlide === slide.id ? colors.primary : (currentSlideIndex === index && isPlaying ? colors.secondary : colors.backgroundSecondary),
                          border: `2px solid ${selectedSlide === slide.id ? colors.primary : (currentSlideIndex === index && isPlaying ? colors.secondary : colors.border)}`,
                          borderRadius: `${borderRadius.sm}px`,
                          padding: spacing.xs,
                          cursor: 'pointer',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div style={{
                          flex: 1,
                          backgroundColor: colors.backgroundTertiary,
                          borderRadius: `${borderRadius.sm / 2}px`,
                          marginBottom: spacing.xs / 2,
                          overflow: 'hidden',
                          backgroundImage: slide.url ? `url(${slide.url})` : 'none',
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }} />
                        <div style={{ fontSize: '10px', color: selectedSlide === slide.id ? colors.white : colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {slide.duration}s
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSlide(slide.id);
                          }}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            background: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: colors.white
                          }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chyron/Titling Track */}
              <div style={{ marginBottom: spacing.md }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Type size={14} color={colors.textSecondary} />
                  <h4 style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>
                    CHYRON / TITLING
                  </h4>
                </div>
                <div style={{
                  minHeight: '60px',
                  backgroundColor: colors.surface,
                  borderRadius: `${borderRadius.md}px`,
                  padding: spacing.sm,
                  border: `1px solid ${colors.border}`,
                  display: 'flex',
                  gap: spacing.xs,
                  alignItems: 'center',
                  overflowX: 'auto'
                }}>
                  {overlays.length === 0 ? (
                    <div style={{
                      padding: spacing.sm,
                      color: colors.textSecondary,
                      fontSize: typography.fontSize.caption,
                      fontStyle: 'italic'
                    }}>
                      Click "Add Overlay" to add text
                    </div>
                  ) : (
                    overlays.map(overlay => (
                      <div
                        key={overlay.id}
                        style={{
                          width: `${overlay.duration * TIMELINE_SCALE}px`,
                          minWidth: `${overlay.duration * TIMELINE_SCALE}px`,
                          height: '50px',
                          backgroundColor: colors.backgroundTertiary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: `${borderRadius.sm}px`,
                          padding: spacing.xs,
                          fontSize: '10px',
                          color: colors.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        <div style={{ fontWeight: typography.fontWeight.semibold, marginBottom: '2px' }}>{overlay.type}</div>
                        <div style={{ color: colors.textSecondary, fontSize: '9px' }}>{overlay.text}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Music/Voiceover Track - FIXED: Audio upload */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Music size={14} color={colors.textSecondary} />
                  <h4 style={{ margin: 0, fontSize: typography.fontSize.caption, color: colors.textSecondary, fontWeight: typography.fontWeight.semibold }}>
                    AUDIO REFERENCE — PLAYBACK / MIX NOT CONNECTED
                  </h4>
                </div>
                <div style={{
                  minHeight: '60px',
                  backgroundColor: colors.surface,
                  borderRadius: `${borderRadius.md}px`,
                  padding: spacing.sm,
                  border: `1px solid ${colors.border}`,
                  display: 'flex',
                  gap: spacing.xs,
                  alignItems: 'center',
                  overflowX: 'auto'
                }}>
                  {audioTracks.length === 0 ? (
                    <div style={{
                      padding: spacing.sm,
                      color: colors.textSecondary,
                      fontSize: typography.fontSize.caption,
                      fontStyle: 'italic'
                    }}>
                      Add an audio reference in the sidebar
                    </div>
                  ) : (
                    audioTracks.map(audio => (
                      <div
                        key={audio.id}
                        style={{
                          width: `${audio.duration * TIMELINE_SCALE}px`,
                          minWidth: `${audio.duration * TIMELINE_SCALE}px`,
                          height: '50px',
                          backgroundColor: colors.success,
                          opacity: 0.8,
                          border: `1px solid ${colors.border}`,
                          borderRadius: `${borderRadius.sm}px`,
                          padding: spacing.xs,
                          fontSize: '10px',
                          color: colors.white,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Volume2 size={14} style={{ marginRight: spacing.xs / 2 }} />
                        <span style={{ fontWeight: typography.fontWeight.semibold }}>{audio.name.substring(0, 10)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAudio(audio.id);
                          }}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            background: 'rgba(0,0,0,0.6)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '16px',
                            height: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: colors.white
                          }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Overlay Panel */}
              {showOverlayPanel && (
                <div style={{
                  marginTop: spacing.lg,
                  backgroundColor: colors.surface,
                  borderRadius: `${borderRadius.lg}px`,
                  padding: spacing.md,
                  border: `1px solid ${colors.border}`
                }}>
                  <h4 style={{ margin: `0 0 ${spacing.sm}px`, fontSize: typography.fontSize.subheadline, fontWeight: typography.fontWeight.semibold }}>
                    Add Overlay
                  </h4>
                  <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.sm }}>
                    <input
                      type="text"
                      placeholder="Address (e.g., 123 Main St, City)"
                      id="overlay-address"
                      style={{
                        flex: 1,
                        padding: spacing.sm,
                        backgroundColor: colors.backgroundSecondary,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        borderRadius: `${borderRadius.sm}px`,
                        fontSize: typography.fontSize.caption
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('overlay-address') as HTMLInputElement;
                        if (input.value) {
                          handleAddOverlay('address', input.value);
                          input.value = '';
                        }
                      }}
                      style={{
                        padding: `${spacing.sm}px ${spacing.md}px`,
                        backgroundColor: colors.primary,
                        color: colors.white,
                        border: 'none',
                        borderRadius: `${borderRadius.sm}px`,
                        cursor: 'pointer',
                        fontSize: typography.fontSize.caption
                      }}
                    >
                      Add
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: spacing.sm }}>
                    <input
                      type="text"
                      placeholder="Price (e.g., $750,000)"
                      id="overlay-price"
                      style={{
                        flex: 1,
                        padding: spacing.sm,
                        backgroundColor: colors.backgroundSecondary,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        borderRadius: `${borderRadius.sm}px`,
                        fontSize: typography.fontSize.caption
                      }}
                    />
                    <button
                      onClick={() => {
                        const input = document.getElementById('overlay-price') as HTMLInputElement;
                        if (input.value) {
                          handleAddOverlay('price', input.value);
                          input.value = '';
                        }
                      }}
                      style={{
                        padding: `${spacing.sm}px ${spacing.md}px`,
                        backgroundColor: colors.primary,
                        color: colors.white,
                        border: 'none',
                        borderRadius: `${borderRadius.sm}px`,
                        cursor: 'pointer',
                        fontSize: typography.fontSize.caption
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {/* End Card Panel */}
              {showEndCardPanel && (
                <div style={{
                  marginTop: spacing.lg,
                  backgroundColor: colors.surface,
                  borderRadius: `${borderRadius.lg}px`,
                  padding: spacing.md,
                  border: `1px solid ${colors.border}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                    <h4 style={{ margin: 0, fontSize: typography.fontSize.subheadline, fontWeight: typography.fontWeight.semibold }}>
                      End Card
                    </h4>
                    <label style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={endCard.enabled}
                        onChange={(e) => setEndCard({ ...endCard, enabled: e.target.checked })}
                      />
                      <span style={{ fontSize: typography.fontSize.caption }}>Enable</span>
                    </label>
                  </div>
                  {endCard.enabled && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                      {/* Logo Upload */}
                      <div>
                        <label style={{ display: 'block', fontSize: typography.fontSize.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>
                          Agency Logo (optional)
                        </label>
                        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
                          <button
                            onClick={() => logoInputRef.current?.click()}
                            style={{
                              flex: 1,
                              padding: spacing.sm,
                              backgroundColor: colors.backgroundSecondary,
                              color: colors.text,
                              border: `1px solid ${colors.border}`,
                              borderRadius: `${borderRadius.sm}px`,
                              cursor: 'pointer',
                              fontSize: typography.fontSize.caption,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: spacing.xs
                            }}
                          >
                            <UploadIcon size={14} />
                            {endCard.brokerageLogo ? 'Change Logo' : 'Upload Logo'}
                          </button>
                          {endCard.brokerageLogo && (
                            <img src={endCard.brokerageLogo} alt="Logo" style={{ height: '30px', objectFit: 'contain' }} />
                          )}
                        </div>
                      </div>

                      {/* Agency Name */}
                      <input
                        type="text"
                        placeholder="Agency Name (optional)"
                        value={endCard.agencyName}
                        onChange={(e) => setEndCard({ ...endCard, agencyName: e.target.value })}
                        style={{
                          padding: spacing.sm,
                          backgroundColor: colors.backgroundSecondary,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          borderRadius: `${borderRadius.sm}px`,
                          fontSize: typography.fontSize.caption
                        }}
                      />

                      {/* Agent Fields */}
                      <div style={{ display: 'flex', gap: spacing.sm }}>
                        <input
                          type="text"
                          placeholder="Agent Name"
                          value={endCard.agentName}
                          onChange={(e) => setEndCard({ ...endCard, agentName: e.target.value })}
                          style={{
                            flex: 1,
                            padding: spacing.sm,
                            backgroundColor: colors.backgroundSecondary,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                            borderRadius: `${borderRadius.sm}px`,
                            fontSize: typography.fontSize.caption
                          }}
                        />
                        <input
                          type="tel"
                          placeholder="Phone"
                          value={endCard.phone}
                          onChange={(e) => setEndCard({ ...endCard, phone: e.target.value })}
                          style={{
                            flex: 1,
                            padding: spacing.sm,
                            backgroundColor: colors.backgroundSecondary,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                            borderRadius: `${borderRadius.sm}px`,
                            fontSize: typography.fontSize.caption
                          }}
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={endCard.email}
                          onChange={(e) => setEndCard({ ...endCard, email: e.target.value })}
                          style={{
                            flex: 1,
                            padding: spacing.sm,
                            backgroundColor: colors.backgroundSecondary,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                            borderRadius: `${borderRadius.sm}px`,
                            fontSize: typography.fontSize.caption
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
