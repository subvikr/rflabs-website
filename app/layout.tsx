import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RFLABS - Stretch Film Manufacturers in Coimbatore',
  description: 'RFLABS provides durable and cost-effective stretch film for all your industrial and commercial packaging needs in Coimbatore.',
  keywords: 'stretch film, packaging, coimbatore, industrial packaging, stretch wrap',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" 
          rel="stylesheet" 
        />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}