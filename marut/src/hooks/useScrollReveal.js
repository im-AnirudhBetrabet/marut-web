import { useEffect } from 'react';

export function useScrollReveal() {
  useEffect(() => {
    const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = reduceQuery.matches;
    const dot = document.querySelector('.cursor-dot');
    const onPointerMove = (event) => {
      if (dot) {
        dot.style.left = `${event.clientX}px`;
        dot.style.top = `${event.clientY}px`;
      }
    };
    if (!reduce && dot && window.matchMedia('(pointer:fine)').matches) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
    }

    const revealTargets = document.querySelectorAll(
      '.section-head, .intro-title, .intro-copy, .produce-heading, .produce-card, .method-title, .method-step, .split-image-inner, .split-quote, .partners h2, .partner-copy, .contact-main > *'
    );
    revealTargets.forEach((element, index) => {
      element.classList.add('reveal');
      if (element.matches('.intro-title, .method-title, .partners h2')) element.dataset.reveal = 'left';
      else if (element.matches('.intro-copy, .partner-copy, .contact-main > *:last-child')) element.dataset.reveal = 'right';
      if (element.matches('.produce-card, .method-step')) element.style.transitionDelay = `${(index % 3) * 90}ms`;
    });

    let observer;
    if (!reduce && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.14, rootMargin: '0px 0px -4% 0px' });
      revealTargets.forEach((element) => observer.observe(element));
    } else {
      revealTargets.forEach((element) => element.classList.add('is-visible'));
    }

    // Preserve the prototype's scroll-aware header and responsive hero parallax.
    const header = document.querySelector('header');
    const hero = document.querySelector('.hero');
    const kicker = document.querySelector('.hero-kicker');
    const lines = document.querySelectorAll('.hero h1 .line');
    const heroCopy = document.querySelector('.hero-copy');
    const heroSide = document.querySelector('.hero-side');
    const photoWrap = document.querySelector('.hero-photo-wrap');
    const photo = document.querySelector('.hero-photo');
    const stamp = document.querySelector('.photo-stamp');
    let lastScrollY = window.scrollY;
    let currentScrollY = window.scrollY;
    let lerpedScrollY = window.scrollY;
    let ticking = false;
    let rafId = 0;
    const lerp = (start, end, factor) => start + (end - start) * factor;

    function updateParallax() {
      lerpedScrollY = lerp(lerpedScrollY, currentScrollY, 0.12);
      const diff = Math.abs(currentScrollY - lerpedScrollY);
      const isMobile = window.innerWidth <= 760;
      if (header) {
        header.classList.toggle('header-scrolled', currentScrollY > 80);
        if (currentScrollY > lastScrollY && currentScrollY > 160) header.classList.add('header-hidden');
        else if (currentScrollY < lastScrollY) header.classList.remove('header-hidden');
      }
      lastScrollY = currentScrollY;
      if (hero && lerpedScrollY <= hero.offsetHeight * 1.5) {
        const progress = lerpedScrollY / hero.offsetHeight;
        const scaleFactor = isMobile ? 0.45 : 1;
        if (kicker) {
          kicker.style.transform = `translate3d(0, ${lerpedScrollY * 0.22 * scaleFactor}px, 0)`;
          kicker.style.opacity = String(Math.max(0, 1 - progress * 1.8));
        }
        lines.forEach((line, index) => {
          const ySpeed = (0.14 + index * 0.07) * scaleFactor;
          const xDir = index === 1 ? 1 : -1;
          const maxHorizDrift = isMobile ? 8 : 40;
          const rawX = lerpedScrollY * (isMobile ? 0.018 : 0.05) * xDir;
          const xShift = Math.max(-maxHorizDrift, Math.min(maxHorizDrift, rawX));
          line.style.transform = `translate3d(${xShift}px, ${lerpedScrollY * ySpeed}px, 0)`;
        });
        if (heroCopy) {
          heroCopy.style.transform = `translate3d(0, ${lerpedScrollY * -0.1 * scaleFactor}px, 0)`;
          heroCopy.style.opacity = String(Math.max(0, 1 - progress * 1.4));
        }
        if (heroSide) {
          heroSide.style.transform = `translate3d(0, ${lerpedScrollY * -0.15 * scaleFactor}px, 0)`;
          heroSide.style.opacity = String(Math.max(0, 1 - progress * 1.4));
        }
        if (photoWrap) photoWrap.style.transform = `translate3d(0, ${lerpedScrollY * -0.05 * scaleFactor}px, 0)`;
        if (photo) {
          const scale = 1 + progress * 0.08;
          photo.style.transform = `translate3d(0, ${lerpedScrollY * 0.18 * scaleFactor}px, 0) scale(${scale})`;
        }
        if (stamp) {
          const rotation = 11 + lerpedScrollY * 0.12 * scaleFactor;
          stamp.style.transform = `translate3d(0, ${lerpedScrollY * -0.12 * scaleFactor}px, 0) rotate(${rotation}deg)`;
        }
      }
      if (diff > 0.1) rafId = window.requestAnimationFrame(updateParallax);
      else ticking = false;
    }
    const onScroll = () => {
      currentScrollY = window.scrollY;
      if (!reduce && !ticking) {
        ticking = true;
        rafId = window.requestAnimationFrame(updateParallax);
      } else if (reduce && header) {
        header.classList.toggle('header-scrolled', currentScrollY > 80);
        header.classList.toggle('header-hidden', currentScrollY > lastScrollY && currentScrollY > 160);
        lastScrollY = currentScrollY;
      }
    };
    if (!reduce) window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      if (observer) observer.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);
}
