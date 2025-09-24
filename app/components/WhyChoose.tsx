'use client'

export default function WhyChoose() {
  const features = [
    {
      id: 1,
      icon: "fas fa-award",
      title: "Superior Quality",
      description: "Our films are manufactured using advanced technology and premium-grade materials, ensuring consistent quality and performance."
    },
    {
      id: 2,
      icon: "fas fa-dollar-sign",
      title: "Competitive Pricing",
      description: "We offer cost-effective solutions without compromising on quality, helping you optimize your packaging budget."
    },
    {
      id: 3,
      icon: "fas fa-cogs",
      title: "Customization",
      description: "We provide tailored solutions to meet the specific requirements of your business."
    },
    {
      id: 4,
      icon: "fas fa-shipping-fast",
      title: "Timely Delivery",
      description: "As a local Coimbatore manufacturer, we ensure fast and reliable delivery to all our clients."
    },
    {
      id: 5,
      icon: "fas fa-headset",
      title: "Exceptional Customer Support",
      description: "Our team of experts is always ready to assist you with your packaging challenges and help you choose the right product."
    },
    {
      id: 6,
      icon: "fas fa-leaf",
      title: "Eco-Friendly Options",
      description: "We are committed to sustainable practices and can provide recyclable film options."
    }
  ]

  return (
    <section className="why-choose-section">
      <div className="container">
        <h2 className="section-title">Why Partner with RFLABS?</h2>
        
        <div className="features-grid">
          {features.map((feature) => (
            <div key={feature.id} className="feature-card">
              <div className="feature-icon">
                <i className={feature.icon}></i>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}