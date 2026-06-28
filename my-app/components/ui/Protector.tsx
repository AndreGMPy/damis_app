/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Lock, Mail, Store } from 'lucide-react'

export default function Protector({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [ingresando, setIngresando] = useState(false)

    useEffect(() => {
        // Revisar si ya hay una sesión activa al cargar
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setLoading(false)
        })

        // Escuchar cambios (cuando inicia sesión o cierra sesión)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })

        return () => subscription.unsubscribe()
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIngresando(true)
        setError('')

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError('Correo o contraseña incorrectos.')
            setIngresando(false)
        }
    }

    // Pantalla de carga mientras verifica
    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-primary/5">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <Store className="text-primary h-12 w-12" />
                    <p className="text-primary font-bold">Cargando sistema...</p>
                </div>
            </div>
        )
    }

    // Pantalla de Login si no hay sesión
    if (!session) {
        return (
            <div className="min-h-screen w-screen flex items-center justify-center bg-primary/5 p-4 animate-in fade-in duration-500">
                <Card className="w-full max-w-md p-8 rounded-[2rem] shadow-xl border-border/50 bg-white">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="bg-primary/10 p-4 rounded-full mb-4">
                            <Lock className="text-primary h-8 w-8" />
                        </div>
                        <h1 className="text-2xl font-black text-foreground">Acceso Restringido</h1>
                        <p className="text-muted-foreground text-sm mt-2">Ingresa tus credenciales para administrar el Punto de Venta.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground ml-1">Correo Electrónico</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ejemplo@correo.com"
                                    required
                                    className="pl-10 h-12 rounded-2xl bg-secondary/30 border-transparent focus-visible:ring-primary/30"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-foreground ml-1">Contraseña</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="pl-10 h-12 rounded-2xl bg-secondary/30 border-transparent focus-visible:ring-primary/30"
                                />
                            </div>
                        </div>

                        {error && <p className="text-sm text-destructive font-bold text-center bg-destructive/10 py-2 rounded-xl">{error}</p>}

                        <Button type="submit" disabled={ingresando} className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform mt-4">
                            {ingresando ? 'Verificando...' : 'Iniciar Sesión'}
                        </Button>
                    </form>
                </Card>
            </div>
        )
    }

    // Si ya inició sesión, le muestra la aplicación normal
    return <>{children}</>
}