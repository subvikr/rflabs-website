# RFLABS Stretch Film Website - Next.js

A modern, responsive website for RFLABS, a stretch film manufacturer based in Coimbatore, built with Next.js 14 and TypeScript.

## Features

- **Modern Design**: Clean, professional design with smooth animations
- **Responsive Layout**: Optimized for all devices (desktop, tablet, mobile)
- **Component-Based Architecture**: Modular React components for easy maintenance
- **SEO Optimized**: Built with Next.js for excellent SEO performance
- **Performance**: Optimized images with Next.js Image component
- **TypeScript**: Full type safety throughout the application
- **Smooth Scrolling**: Seamless navigation between sections
- **Contact Form**: Interactive quote request form with validation

## Project Structure

```
├── app/
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Hero.tsx
│   │   ├── About.tsx
│   │   ├── Products.tsx
│   │   ├── WhyChoose.tsx
│   │   ├── Testimonials.tsx
│   │   ├── CTA.tsx
│   │   └── Footer.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── public/
│   └── images/
│       ├── logo.jpg
│       ├── blue.jpg
│       ├── mainbackgroundimage.png
│       ├── Machine Stretch Film.png
│       ├── Handgrade.png
│       └── Coloured Stretch Film.png
├── package.json
├── next.config.js
├── tsconfig.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18.0 or later
- npm or yarn

### Installation

1. Clone the repository or create a new Next.js project:

```bash
npx create-next-app@latest rflabs-website --typescript --tailwind --eslint --app
cd rflabs-website
```

2. Install dependencies:

```bash
npm install
```

3. Add the project files to the appropriate directories as shown in the project structure.

4. Create the `public/images/` directory and add all the required images:
   - logo.jpg
   - blue.jpg
   - mainbackgroundimage.png
   - Machine Stretch Film.png
   - Handgrade.png
   - Coloured Stretch Film.png

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Components

### Header Component
- Fixed navigation with smooth scroll
- Mobile-responsive hamburger menu
- Logo and navigation links
- Scroll-based styling changes

### Hero Section
- Full-screen hero with background image
- Compelling headline and call-to-action
- Responsive text sizing

### Products Section
- Grid layout showcasing three main products
- Hover effects and animations
- Product images and descriptions

### Quote Form
- Interactive contact form with validation
- Multiple form fields for comprehensive quotes
- Email and phone number validation

### Footer
- Company contact information
- Quick navigation links
- Social media links

## Styling

The project uses custom CSS with:
- CSS Grid and Flexbox for layouts
- CSS Custom Properties for consistent theming
- Responsive design with media queries
- Smooth animations and transitions
- Modern glassmorphism effects

## Deployment

### Vercel (Recommended)

1. Push your code to a GitHub repository
2. Connect your repository to Vercel
3. Deploy with automatic CI/CD

### Other Platforms

The project can be deployed on any platform that supports Next.js:
- Netlify
- AWS Amplify
- DigitalOcean App Platform

## Performance Optimizations

- Next.js Image component for optimized image loading
- Component-based architecture for code splitting
- CSS optimization and minification
- Font optimization with Google Fonts

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

© 2025 RFLABS. All Rights Reserved.

## Contact

For questions about the website or RFLABS services:
- Email: Giridhar@rflabs.in
- Phone: 9994094973
- Address: 2247, Trichy Road, Coimbatore - 641005