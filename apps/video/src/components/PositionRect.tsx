import React, { useEffect, useState, useRef } from 'react';

interface PositionRectProps {
    position: 'start' | 'end';
    scale: number; // 80-120 (percentage)
    offsetX: number; // -10 to 10 (percentage)
    offsetY: number; // -10 to 10 (percentage)
    isSelected: boolean;
    onSelect: () => void;
    onChange: (scale: number, offsetX: number, offsetY: number) => void;
}

export const PositionRect: React.FC<PositionRectProps> = ({
    position,
    scale,
    offsetX,
    offsetY,
    isSelected,
    onSelect,
    onChange
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeCorner, setResizeCorner] = useState<'tl' | 'tr' | 'bl' | 'br' | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Calculate rect dimensions based on scale (100% = full size, <100% = smaller)
    const getRectStyle = () => {
        const baseWidth = 100; // percentage
        const baseHeight = 100; // percentage

        // Scale affects size
        const width = (scale / 100) * baseWidth;
        const height = (scale / 100) * baseHeight;

        // Position centered, then offset
        const left = 50 - (width / 2) + offsetX;
        const top = 50 - (height / 2) + offsetY;

        return {
            position: 'absolute' as const,
            left: `${left}%`,
            top: `${top}%`,
            width: `${width}%`,
            height: `${height}%`,
            border: isSelected ? '2px solid white' : '2px dashed rgba(255, 255, 255, 0.7)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
            cursor: isDragging ? 'grabbing' : 'grab',
            pointerEvents: 'auto' as const
        };
    };

    const handleMouseDown = (e: React.MouseEvent, corner?: 'tl' | 'tr' | 'bl' | 'br') => {
        e.stopPropagation();
        onSelect();

        if (corner) {
            setIsResizing(true);
            setResizeCorner(corner);
        } else {
            setIsDragging(true);
        }

        setDragStart({ x: e.clientX, y: e.clientY });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            const container = containerRef.current.parentElement;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;

            if (isDragging) {
                // Convert pixel delta to percentage
                const percentX = (deltaX / rect.width) * 100;
                const percentY = (deltaY / rect.height) * 100;

                const newOffsetX = Math.max(-10, Math.min(10, offsetX + percentX));
                const newOffsetY = Math.max(-10, Math.min(10, offsetY + percentY));

                onChange(scale, newOffsetX, newOffsetY);
                setDragStart({ x: e.clientX, y: e.clientY });
            } else if (isResizing && resizeCorner) {
                // Calculate scale change based on diagonal drag
                const diagonal = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const direction = resizeCorner.includes('t') ? 1 : -1; // top corners shrink, bottom grow
                const scaleChange = (diagonal / rect.width) * direction * 50; // Sensitivity adjustment

                const newScale = Math.max(80, Math.min(120, scale + scaleChange));
                onChange(newScale, offsetX, offsetY);
                setDragStart({ x: e.clientX, y: e.clientY });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
            setResizeCorner(null);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, dragStart, scale, offsetX, offsetY, resizeCorner, onChange]);

    return (
        <div
            ref={containerRef}
            style={getRectStyle()}
            onMouseDown={(e) => handleMouseDown(e)}
        >
            {/* Corner resize handles */}
            {isSelected && (
                <>
                    <div
                        onMouseDown={(e) => handleMouseDown(e, 'tl')}
                        style={{
                            position: 'absolute',
                            top: '-4px',
                            left: '-4px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: 'white',
                            border: '1px solid black',
                            cursor: 'nwse-resize'
                        }}
                    />
                    <div
                        onMouseDown={(e) => handleMouseDown(e, 'tr')}
                        style={{
                            position: 'absolute',
                            top: '-4px',
                            right: '-4px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: 'white',
                            border: '1px solid black',
                            cursor: 'nesw-resize'
                        }}
                    />
                    <div
                        onMouseDown={(e) => handleMouseDown(e, 'bl')}
                        style={{
                            position: 'absolute',
                            bottom: '-4px',
                            left: '-4px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: 'white',
                            border: '1px solid black',
                            cursor: 'nesw-resize'
                        }}
                    />
                    <div
                        onMouseDown={(e) => handleMouseDown(e, 'br')}
                        style={{
                            position: 'absolute',
                            bottom: '-4px',
                            right: '-4px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: 'white',
                            border: '1px solid black',
                            cursor: 'nwse-resize'
                        }}
                    />
                </>
            )}

            {/* Label */}
            <div style={{
                position: 'absolute',
                top: '-20px',
                left: '0',
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold',
                textShadow: '0 0 3px black',
                pointerEvents: 'none'
            }}>
                {position === 'start' ? 'Start' : 'End'}
            </div>
        </div>
    );
};
