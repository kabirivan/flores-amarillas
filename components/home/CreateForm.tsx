'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { cleanFrom, cleanName, LIMITS } from '@/lib/link/sanitize'
import styles from './Home.module.css'

/** Nombre de quien recibe (y, opcional, de quien regala) → /para/{nombre}?de=… */
export function CreateForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [from, setFrom] = useState('')
  const clean = cleanName(name)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!clean) return
    const de = cleanFrom(from)
    router.push(`/para/${encodeURIComponent(clean)}${de ? `?de=${encodeURIComponent(de)}` : ''}`)
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label className={styles.field}>
        <span>¿Para quién es?</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={LIMITS.name} autoComplete="off" placeholder="María" required />
      </label>
      <label className={styles.field}>
        <span>¿De parte de quién? (opcional)</span>
        <input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={LIMITS.from} autoComplete="off" placeholder="Tu nombre" />
      </label>
      <Button type="submit" disabled={!clean}>
        Ver su ramo
      </Button>
    </form>
  )
}
