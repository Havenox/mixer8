import React, { useState, useEffect, useRef } from 'react';

interface RotaryKnobProps {
  value: number; // -1.0 a 1.0
  onChange: (newValue: number) => void;
  size?: number; // Largura/altura em pixels
  label?: string; // Nome sob o knob
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  value,
  onChange,
  size = 46,
  label = 'PAN'
}) => {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const [activeDrag, setActiveDrag] = useState(false);

  // Mapeia o valor de -1.0..1.0 para o ângulo de -135deg a +135deg
  const angle = value * 135;

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    setActiveDrag(true);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY; // Subir aumenta, descer diminui
    // Sensibilidade de precisão: 150px de movimento vertical para ir de -1.0 a 1.0
    const deltaVal = deltaY / 150;
    let newVal = startVal.current + deltaVal;
    newVal = Math.max(-1.0, Math.min(1.0, newVal));
    onChange(newVal);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    setActiveDrag(false);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  // Suporte para Touch (Dispositivos Móveis e Tablets)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startVal.current = value;
    setActiveDrag(true);

    // Evita o scroll de página durante o ajuste
    if (e.cancelable) {
      e.preventDefault();
    }

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    
    // Evita o scroll
    if (e.cancelable) {
      e.preventDefault();
    }

    const deltaY = startY.current - e.touches[0].clientY;
    const deltaVal = deltaY / 150;
    let newVal = startVal.current + deltaVal;
    newVal = Math.max(-1.0, Math.min(1.0, newVal));
    onChange(newVal);
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    setActiveDrag(false);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
  };

  // Limpeza de ouvintes de eventos
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  // Formata o texto exibido sob o knob
  const getPanText = () => {
    if (Math.abs(value) < 0.03) return 'C'; // Center
    if (value < 0) return `L${Math.round(Math.abs(value) * 100)}`;
    return `R${Math.round(value * 100)}`;
  };

  // Parâmetros para renderização do Arco do Dial SVG
  const radius = 16;
  const circumference = 2 * Math.PI * radius;

  // O dial completo representa 270 graus do círculo (de -135deg a 135deg).
  const maxArcLength = (135 / 360) * circumference;
  const activeArcLength = Math.abs(value) * maxArcLength;

  return (
    <div className="flex flex-col items-center select-none" style={{ width: size + 16 }}>
      {/* Container do Knob */}
      <div 
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={() => onChange(0.0)} // Atalho rápido para centralizar
        className={`relative flex items-center justify-center rounded-full cursor-ns-resize transition-all duration-150 ${
          activeDrag ? 'scale-105 shadow-glow' : 'hover:scale-102'
        }`}
        style={{ width: size, height: size }}
      >
        {/* Anel de LED / Feedback Circular de Trilha */}
        <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 40 40">
          {/* Fundo da trilha inativa */}
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="transparent"
            stroke="#282828"
            strokeWidth="2.5"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeDashoffset={circumference * 0.125} 
            strokeLinecap="round"
          />

          {/* Lado Esquerdo Ativo (L) */}
          {value < 0 && (
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="transparent"
              stroke="#1db954"
              strokeWidth="2.5"
              strokeDasharray={`${activeArcLength} ${circumference}`}
              strokeDashoffset={circumference * 0.25} 
              strokeLinecap="round"
              className="transition-all duration-75"
              style={{
                transformOrigin: '20px 20px',
                transform: 'scaleY(-1) rotate(180deg)' 
              }}
            />
          )}

          {/* Lado Direito Ativo (R) */}
          {value > 0 && (
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="transparent"
              stroke="#1db954"
              strokeWidth="2.5"
              strokeDasharray={`${activeArcLength} ${circumference}`}
              strokeDashoffset={circumference * 0.75} 
              strokeLinecap="round"
              className="transition-all duration-75"
            />
          )}
        </svg>

        {/* Corpo do Knob Físico */}
        <div 
          className="w-8 h-8 rounded-full bg-gradient-to-b from-[#333333] to-[#1e1e1e] shadow-xl flex items-center justify-center border border-[#444444]/40"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: activeDrag ? 'none' : 'transform 100ms ease-out'
          }}
        >
          {/* Indicador de Linha (Agulha física do knob) */}
          <div className="w-[2px] h-3.5 bg-brand-green -mt-3.5 rounded-full shadow-[0_0_4px_#1db954]" />
        </div>
      </div>

      {/* Label de Valor & Texto de Balanço */}
      <span className="text-[9px] font-black text-brand-gray tracking-wider mt-1 truncate max-w-full select-none text-center">
        {label}
      </span>
      <span className="text-[8px] font-mono font-bold text-brand-green select-none leading-none mt-0.5">
        {getPanText()}
      </span>
    </div>
  );
};
