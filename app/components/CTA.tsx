'use client'

import { useState } from 'react'

interface FormData {
  name: string
  company: string
  email: string
  phone: string
  filmType: string
  message: string
}

export default function CTA() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    company: '',
    email: '',
    phone: '',
    filmType: '',
    message: ''
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.name || !formData.company || !formData.email || !formData.phone || !formData.filmType || !formData.message) {
      alert('Please fill in all required fields.')
      return
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      alert('Please enter a valid email address.')
      return
    }
    
    // Phone validation (basic)
    const phoneRegex = /^[\d\s\+\-\(\)]+$/
    if (!phoneRegex.test(formData.phone)) {
      alert('Please enter a valid phone number.')
      return
    }
    
    // Success message (in a real application, this would send data to a server)
    alert('Thank you for your quote request! We will contact you within 24 hours.')
    
    // Reset form
    setFormData({
      name: '',
      company: '',
      email: '',
      phone: '',
      filmType: '',
      message: ''
    })
  }

  return (
    <section id="quote" className="cta-section">
      <div className="container">
        <div className="cta-content">
          <div className="cta-text">
            <h2>Ready to Secure Your Shipments?</h2>
            <p>Get a free, no-obligation quote today!</p>
          </div>
          
          <form className="quote-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <input
                  type="text"
                  name="name"
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="text"
                  name="company"
                  placeholder="Company Name"
                  value={formData.company}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <input
                  type="tel"
                  name="phone"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <select
                name="filmType"
                value={formData.filmType}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Film Type</option>
                <option value="machine-grade">Machine Grade Stretch Film</option>
                <option value="hand-grade">Hand Grade Stretch Film</option>
                <option value="colored">Colored & Opaque Stretch Film</option>
                <option value="customized">Customized Stretch Film</option>
              </select>
            </div>
            
            <div className="form-group">
              <textarea
                name="message"
                placeholder="Tell us about your specific needs, required quantity, and any other requirements..."
                rows={4}
                value={formData.message}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <button type="submit" className="btn-primary">
              Request Quote
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}