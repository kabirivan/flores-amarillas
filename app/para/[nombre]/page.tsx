import { redirect } from 'next/navigation'

/**
 * Los enlaces que se enviaron con un nombre (/para/Quien) llevan a la historia completa.
 * El nombre no se usa: la historia es genérica, «Para ti» (ver app/historia/page.tsx).
 */
export default function Page() {
  redirect('/historia')
}
