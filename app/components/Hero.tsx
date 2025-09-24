'use client'

import Image from 'next/image'

export default function Hero() {
  const scrollToQuote = () => {
    const element = document.getElementById('quote')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <section id="home" className="hero">
      <div className="hero-background">
        <Image
          src="/images/mainbackgroundimage.png"
          alt="Industrial warehouse"
          fill
          className="hero-image"
          style={{ objectFit: 'cover' }}
          priority
        />
        <div className="hero-overlay"></div>
      </div>
      <div className="container hero-content">
        <h1 className="hero-title">High-Quality Stretch Film Solutions in Coimbatore</h1>
        <p className="hero-subtitle">
          RFLABS provides durable and cost-effective stretch film for all your industrial and commercial packaging needs.
        </p>
        <button onClick={scrollToQuote} className="btn-primary">
          Get a Free Quote
        </button>
      </div>
    </section>
  )
}