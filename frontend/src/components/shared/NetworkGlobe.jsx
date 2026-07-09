import { useRef, useEffect } from 'react';
import useThemeStore from '../../store/themeStore';

export default function NetworkGlobe({ 
  size = 300 
}) {
  const canvasRef = useRef(null);
  const theme = useThemeStore(s => s.theme);
  const isLight = theme === 'light';
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = size;
    const height = size;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = size * 0.38;
    let rotation = 0;
    
    const colors = isLight ? {
      wireframe: 'rgba(0, 102, 255, 0.15)',
      activeNode: 'rgba(0, 102, 255, 0.8)',
      regularNode: 'rgba(148, 163, 184, 0.7)',
      connection: 'rgba(0, 102, 255, 0.4)',
      particle: 'rgba(5, 150, 105, 0.8)',
      glow: 'rgba(0, 102, 255, 0.05)',
    } : {
      wireframe: 'rgba(108, 99, 255, 0.06)',
      activeNode: 'rgba(108, 99, 255, 0.9)',
      regularNode: 'rgba(148, 163, 184, 0.6)',
      connection: 'rgba(108, 99, 255, 0.4)',
      particle: 'rgba(16, 185, 129, 0.8)',
      glow: 'rgba(108, 99, 255, 0.06)',
    };
    
    // Generate node positions on sphere
    const nodes = [];
    for (let i = 0; i < 50; i++) {
      const lat = (Math.random() - 0.5) 
        * Math.PI;
      const lon = Math.random() 
        * Math.PI * 2;
      nodes.push({
        lat, lon,
        size: 1.5 + Math.random() * 2,
        pulseSpeed: 0.02 + 
          Math.random() * 0.03,
        pulsePhase: Math.random() 
          * Math.PI * 2,
        // Some nodes are "active" 
        // (brighter, larger)
        active: Math.random() > 0.7,
      });
    }
    
    // Generate connections between 
    // nearby nodes
    const connections = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; 
           j < nodes.length; j++) {
        const dist = Math.sqrt(
          Math.pow(nodes[i].lat - 
            nodes[j].lat, 2) +
          Math.pow(nodes[i].lon - 
            nodes[j].lon, 2)
        );
        if (dist < 1.2 && 
            connections.length < 60) {
          connections.push({
            from: i, to: j,
            particlePos: Math.random(),
            particleSpeed: 0.003 + 
              Math.random() * 0.005,
            particleDir: 
              Math.random() > 0.5 ? 1 : -1,
          });
        }
      }
    }
    
    // Project 3D point to 2D
    const project = (lat, lon, rot) => {
      const x = Math.cos(lat) * 
        Math.sin(lon + rot);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * 
        Math.cos(lon + rot);
      
      // Only show front-facing points
      const visible = z > -0.2;
      const opacity = visible 
        ? Math.min(1, (z + 0.2) / 1.2) 
        : 0;
      
      return {
        x: centerX + x * radius,
        y: centerY - y * radius,
        z,
        visible,
        opacity,
      };
    };
    
    let animFrame;
    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      rotation += 0.003;
      const time = Date.now() * 0.001;
      
      // Draw background glow
      const glow = ctx.createRadialGradient(
        centerX, centerY, radius * 0.3,
        centerX, centerY, radius * 1.3
      );
      glow.addColorStop(0, colors.glow);
      glow.addColorStop(0.5, isLight ? 'rgba(0, 102, 255, 0.02)' : 'rgba(108, 99, 255, 0.02)');
      glow.addColorStop(1, isLight ? 'rgba(0, 102, 255, 0)' : 'rgba(108, 99, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);
      
      // Draw globe outline circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, 
        radius, 0, Math.PI * 2);
      ctx.strokeStyle = isLight ? 'rgba(0, 102, 255, 0.2)' : 'rgba(108, 99, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw latitude lines
      for (let lat = -60; lat <= 60; 
           lat += 30) {
        const latRad = (lat / 180) 
          * Math.PI;
        ctx.beginPath();
        let started = false;
        for (let lon = 0; lon <= 360; 
             lon += 5) {
          const lonRad = (lon / 180) 
            * Math.PI;
          const p = project(latRad, 
            lonRad, rotation);
          if (p.opacity > 0.1) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.strokeStyle = colors.wireframe;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      
      // Draw longitude lines
      for (let lon = 0; lon < 360; 
           lon += 30) {
        const lonRad = (lon / 180) 
          * Math.PI;
        ctx.beginPath();
        let started = false;
        for (let lat = -90; lat <= 90; 
             lat += 5) {
          const latRad = (lat / 180) 
            * Math.PI;
          const p = project(latRad, 
            lonRad, rotation);
          if (p.opacity > 0.1) {
            if (!started) {
              ctx.moveTo(p.x, p.y);
              started = true;
            } else {
              ctx.lineTo(p.x, p.y);
            }
          } else {
            started = false;
          }
        }
        ctx.strokeStyle = colors.wireframe;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      
      // Project all nodes
      const projected = nodes.map(
        (n, i) => ({
          ...project(n.lat, n.lon, 
            rotation),
          ...n,
          index: i,
        })
      );
      
      // Draw connections (behind nodes)
      connections.forEach(conn => {
        const from = projected[conn.from];
        const to = projected[conn.to];
        
        if (from.opacity < 0.2 || 
            to.opacity < 0.2) return;
        
        const lineOpacity = 
          Math.min(from.opacity, 
            to.opacity) * 0.4;
        
        // Connection line
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        const gradient = 
          ctx.createLinearGradient(
            from.x, from.y, to.x, to.y);
        gradient.addColorStop(0, 
          colors.connection.replace(/[\d.]+\)$/g, `${lineOpacity})`));
        gradient.addColorStop(0.5, 
          colors.particle.replace(/[\d.]+\)$/g, `${lineOpacity * 0.8})`));
        gradient.addColorStop(1, 
          colors.connection.replace(/[\d.]+\)$/g, `${lineOpacity})`));
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        
        // Traveling particle
        conn.particlePos += 
          conn.particleSpeed * 
          conn.particleDir;
        if (conn.particlePos > 1) 
          conn.particlePos = 0;
        if (conn.particlePos < 0) 
          conn.particlePos = 1;
        
        const px = from.x + 
          (to.x - from.x) * 
          conn.particlePos;
        const py = from.y + 
          (to.y - from.y) * 
          conn.particlePos;
        
        // Particle glow
        const particleGlow = 
          ctx.createRadialGradient(
            px, py, 0, px, py, 4);
        particleGlow.addColorStop(0, 
          colors.particle.replace(/[\d.]+\)$/g, `${lineOpacity * 2})`));
        particleGlow.addColorStop(1, 
          colors.particle.replace(/[\d.]+\)$/g, '0)'));
        ctx.fillStyle = particleGlow;
        ctx.fillRect(px - 4, py - 4, 
          8, 8);
        
        // Particle dot
        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, 
          Math.PI * 2);
        ctx.fillStyle = 
          colors.particle.replace(/[\d.]+\)$/g, `${lineOpacity * 3})`);
        ctx.fill();
      });
      
      // Draw nodes (front-facing only)
      projected
        .filter(n => n.opacity > 0.1)
        .sort((a, b) => a.z - b.z)
        .forEach(n => {
          const pulse = Math.sin(
            time * n.pulseSpeed * 60 + 
            n.pulsePhase) * 0.3 + 0.7;
          const nodeSize = n.size * pulse;
          
          if (n.active) {
            // Active node glow
            const nodeGlow = 
              ctx.createRadialGradient(
                n.x, n.y, 0, 
                n.x, n.y, nodeSize * 4);
            nodeGlow.addColorStop(0, 
              colors.activeNode.replace(/[\d.]+\)$/g, `${n.opacity * (isLight ? 0.2 : 0.3)})`));
            nodeGlow.addColorStop(1, 
              colors.activeNode.replace(/[\d.]+\)$/g, '0)'));
            ctx.fillStyle = nodeGlow;
            ctx.fillRect(
              n.x - nodeSize * 4, 
              n.y - nodeSize * 4, 
              nodeSize * 8, 
              nodeSize * 8);
            
            // Active node dot
            ctx.beginPath();
            ctx.arc(n.x, n.y, 
              nodeSize * 1.5, 0, 
              Math.PI * 2);
            ctx.fillStyle = 
              colors.activeNode.replace(/[\d.]+\)$/g, `${n.opacity * (isLight ? 0.7 : 0.9)})`);
            ctx.fill();
          } else {
            // Regular node
            ctx.beginPath();
            ctx.arc(n.x, n.y, 
              nodeSize, 0, 
              Math.PI * 2);
            ctx.fillStyle = 
              colors.regularNode.replace(/[\d.]+\)$/g, `${n.opacity * 0.6})`);
            ctx.fill();
          }
        });
      
      // Draw outer ring pulse
      const ringPulse = Math.sin(
        time * 0.5) * 0.03 + 0.97;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 
        radius * ringPulse * 1.05, 0, 
        Math.PI * 2);
      ctx.strokeStyle = colors.wireframe;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Inner subtle ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, 
        radius * 0.98, 0, Math.PI * 2);
      ctx.strokeStyle = isLight ? 'rgba(0, 102, 255, 0.08)' : 'rgba(108, 99, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      
      animFrame = 
        requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animFrame) 
        cancelAnimationFrame(animFrame);
    };
  }, [size]);
  
  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
        }}
      />
      {/* Subtle label below globe */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 10,
        color: 'rgba(148, 163, 184, 0.4)',
        letterSpacing: 3,
        textTransform: 'uppercase',
        fontWeight: 500,
      }}>
        Cloud Infrastructure
      </div>
    </div>
  );
}
