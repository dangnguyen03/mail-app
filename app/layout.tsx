import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { TokenProvider } from './components/provider/TokenProvider'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: ' Thành Đăng App',
  description: 'Bulk email sending and reply tracking with Gmail API',
  generator: 'dangnt',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <TokenProvider>
          {children}
        </TokenProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode
// }>) {
//   return (
//     <html lang="en" className="bg-background">
//       <body className="font-sans antialiased">
//         <TokenProvider>
//           {children}
//         </TokenProvider>
//         {process.env.NODE_ENV === 'production' && <Analytics />}
//       </body>
//     </html>
//   )
// }
