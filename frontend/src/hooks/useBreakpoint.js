import { useState, useEffect } from 'react';

export default function useBreakpoint() {
  const [width, setWidth] = useState(window.innerWidth);
  const [height, setHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handler = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };
    window.addEventListener('resize', handler);
    // Some mobile browsers fire 'resize' late (or not at all) on rotation —
    // 'orientationchange' catches it immediately so width/height are never
    // stale right after a real device rotation.
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  return {
    isMobile: width < 640,
    isTablet: width >= 640 && width < 1024,
    isDesktop: width >= 1024,
    width,
    height,
  };
}
