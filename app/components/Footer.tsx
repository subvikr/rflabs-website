'use client'

import Image from 'next/image'

export default function Footer() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <footer id="contact" className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <Image
              src="/images/logo.jpg"
              alt="RFLABS Logo"
              width={40}
              height={40}
              className="footer-logo"
            />
            <p>
              Your trusted partner in packaging solutions, delivering quality stretch film 
              products across Coimbatore and beyond.
            </p>
          </div>
          
          <div className="footer-section">
            <h4>Contact Information</h4>
            <div className="contact-item">
              <i className="fas fa-map-marker-alt"></i>
              <span>2247, Trichy Road, Coimbatore - 641005</span>
            </div>
            <div className="contact-item">
              <i className="fas fa-phone"></i>
              <span>9994094973</span>
            </div>
            <div className="contact-item">
              <i className="fas fa-envelope"></i>
              <span>Giridhar@rflabs.in</span>
            </div>
          </div>
          
          <div className="footer-section">
            <h4>Quick Links</h4>
            <ul className="footer-links">
              <li>
                <button onClick={() => scrollToSection('home')}>Home</button>
              </li>
              <li>
                <button onClick={() => scrollToSection('products')}>Products</button>
              </li>
              <li>
                <button onClick={() => scrollToSection('about')}>About Us</button>
              </li>
              <li>
                <button onClick={() => scrollToSection('contact')}>Contact</button>
              </li>
              <li>
                <a href="#privacy">Privacy Policy</a>
              </li>
              <li>
                <a href="#terms">Terms of Service</a>
              </li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Follow Us</h4>
            <div className="social-links">
              <a href="#" className="social-link">
                <i className="fab fa-facebook-f"></i>
              </a>
              <a href="#" className="social-link">
                <i className="fab fa-linkedin-in"></i>
              </a>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2025 RFLABS. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  )
}