import React from 'react';
export default function Hero() {
 return (
    <section className="hero" id="top">
        <div className="hero-kicker">
            <span className="eyebrow">A new kind of growing company</span><span className="section-label">01 — Built for better food</span>
        </div>
        <h1 aria-label="Fresh by nature. Precise by design.">
            <span className="line">Fresh by</span>
            <span className="line outline">nature.</span>
            <span className="line">Made {" "}
                <span className="outline">better.</span>
            </span>
        </h1>
        <div className="hero-bottom">
            <div className="hero-copy">
                <strong>Good food should feel simple.</strong>
                    <br/>We’re building a thoughtful way to grow fresh produce — bringing nature and growing science into better balance.
            </div>
            <div className="hero-photo-wrap">
                <img className="hero-photo" src="https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1800&q=85" alt="Fresh leafy greens in natural light" width="1800" height="1200" fetchPriority="high"/>
                <div className="photo-stamp">Grown<br/>with care<br/>since day one</div>
            </div>
            <div className="hero-side">
                <span>Rooted near Bengaluru<br/>Growing for what’s next</span>
                <a className="arrow-link" href="#approach">Discover MARUT <span>↘</span></a>
            </div>
        </div>
    </section>
 );
}
