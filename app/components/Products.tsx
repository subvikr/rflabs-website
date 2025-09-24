'use client';

import Image from 'next/image';

interface Product {
  id: number;
  title: string;
  description: string;
  image: string;
}

export default function Products() {
  const products: Product[] = [
    {
      id: 1,
      title: "Machine Grade Stretch Film",
      description: "High-performance film for automated wrapping systems. Maximizes efficiency and provides excellent load retention. Ideal for high-volume operations.",
      image: "/images/Machine Stretch Film.png"
    },
    {
      id: 2,
      title: "Hand Grade Stretch Film", 
      description: "Easy-to-use and versatile film for manual wrapping applications. Offers superior cling and puncture resistance. Perfect for smaller businesses or irregular loads.",
      image: "/images/Handgrade.png"
    },
    {
      id: 3,
      title: "Colored & Opaque Stretch Film",
      description: "Provides privacy and security for sensitive shipments. Available in various colors for color-coding or branding purposes.",
      image: "/images/Coloured Stretch Film.png"
    }
  ];

  return (
    <section id="products" className="products-section">
      <div className="container">
        <h2 className="section-title">Our Products</h2>
        <p className="section-subtitle">
          Explore our wide range of stretch film products, tailored to meet diverse packaging requirements.
        </p>
        
        <div className="products-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card">
              <div className="product-image">
                <Image
                  src={product.image}
                  alt={product.title}
                  fill
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <div className="product-content">
                <h3>{product.title}</h3>
                <p>{product.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}