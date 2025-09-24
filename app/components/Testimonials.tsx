'use client'

export default function Testimonials() {
  const testimonials = [
    {
      id: 1,
      text: "RFLABS has been our go-to supplier for stretch film for years. Their product quality is unmatched, and their quick delivery has streamlined our operations.",
      author: "Rajesh Kumar",
      position: "Operations Manager, LogiTech Industries"
    },
    {
      id: 2,
      text: "The team at RFLABS helped us find the perfect film for our specific application. Their expertise and customer service are outstanding.",
      author: "Priya Sharma",
      position: "Supply Chain Director, PackPro Solutions"
    },
    {
      id: 3,
      text: "Excellent quality products and reliable service. RFLABS has become an integral part of our packaging strategy.",
      author: "Arun Krishnan",
      position: "CEO, SecurePack Ltd"
    }
  ]

  return (
    <section className="testimonials-section">
      <div className="container">
        <h2 className="section-title">What Our Clients Say</h2>
        
        <div className="testimonials-grid">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="testimonial-card">
              <div className="testimonial-content">
                <p>"{testimonial.text}"</p>
              </div>
              <div className="testimonial-author">
                <strong>{testimonial.author}</strong>
                <span>{testimonial.position}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}