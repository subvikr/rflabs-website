'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Header from './components/Header'
import Hero from './components/Hero'
import About from './components/About'
import Products from './components/Products'
import WhyChoose from './components/WhyChoose'
import Testimonials from './components/Testimonials'
import CTA from './components/CTA'
import Footer from './components/Footer'

export default function Home() {
  return (
    <main>
      <Header />
      <Hero />
      <About />
      <Products />
      <WhyChoose />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  )
}