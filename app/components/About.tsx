'use client'

import Image from 'next/image'

export default function About() {
  return (
    <section id="about" className="intro-section">
      <div className="container">
        <div className="intro-content">
          <div className="intro-text">
            <h2>About RFLABS</h2>
            <p>
              RFLABS, a leading innovator of premium stretch film, is proudly based in Coimbatore. 
              We are committed to delivering reliable packaging solutions that protect your products 
              during transit and storage.
            </p>
            <p>
              With state-of-the-art technology and a focus on quality, our films are designed to 
              provide maximum load stability, tear resistance, and puncture protection, ensuring 
              your goods arrive at their destination safe and secure.
            </p>
          </div>
          <div className="intro-image">
            <Image
              src="https://images.unsplash.com/photo-1553413077-190dd305871c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2126&q=80"
              alt="Modern factory interior"
              width={600}
              height={400}
              style={{ 
                width: '100%', 
                height: '400px', 
                objectFit: 'cover',
                borderRadius: '15px',
                boxShadow: '0 15px 35px rgba(0, 0, 0, 0.1)'
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}