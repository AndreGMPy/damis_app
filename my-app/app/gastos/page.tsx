'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ArrowLeft, Trash2, ReceiptText } from 'lucide-react'
import Link from 'next/link'

interface Gasto {
    id: number
    created_at: string
    concepto: string
    monto: number
}

export default function GastosPage() {
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [loading, setLoading] = useState(true)
    const [open, setOpen] = useState(false)

    const [concepto, setConcepto] = useState('')
    const [monto, setMonto] = useState('')
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState({ visible: false, mensaje: '' })

    const mostrarToast = (mensaje: string) => {
        setToast({ visible: true, mensaje })
        setTimeout(() => setToast({ visible: false, mensaje: '' }), 3000)
    }

    const fetchGastos = async () => {
        setLoading(true)
        const { data } = await supabase.from('Gastos').select('*').order('created_at', { ascending: false })
        if (data) setGastos(data)
        setLoading(false)
    }

    useEffect(() => { fetchGastos() }, [])

    const handleGuardarGasto = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!concepto || !monto) return
        setSaving(true)

        await supabase.from('Gastos').insert([{ concepto, monto: parseFloat(monto) }])

        setConcepto('')
        setMonto('')
        setOpen(false)
        fetchGastos()
        mostrarToast('💸 Egreso registrado en el balance mensual.')
        setSaving(false)
    }

    const handleEliminarGasto = async (id: number, conceptoGasto: string) => {
        if (!window.confirm(`¿Eliminar registro de gasto: "${conceptoGasto}"?`)) return
        await supabase.from('Gastos').delete().eq('id', id)
        fetchGastos()
        mostrarToast('🗑️ Gasto cancelado correctamente.')
    }

    const totalGastos = gastos.reduce((acc, curr) => acc + curr.monto, 0)

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 relative animate-in fade-in duration-500">

            {/* BOTÓN REGRESAR */}
            <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold bg-primary/10 hover:bg-primary/20 px-4 py-2.5 rounded-2xl w-fit">
                <ArrowLeft size={18} />
                Regresar al Panel
            </Link>

            <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-primary text-white px-6 py-4 rounded-2xl shadow-xl font-medium flex items-center gap-3">{toast.mensaje}</div>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Control de Salidas y Gastos</h1>
                    <p className="text-muted-foreground mt-1">Monitorea los costos operativos, compras de insumos y renta de caja.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:block text-right mr-4">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Flujo Total de Egresos</p>
                        <p className="text-2xl font-black text-destructive">${totalGastos.toFixed(2)} MXN</p>
                    </div>
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button variant="destructive" className="rounded-2xl h-12 px-6 shadow-md hover:shadow-lg bg-destructive/90 text-white font-bold flex items-center gap-2">
                                <ReceiptText size={18} /> + Registrar Gasto
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] rounded-3xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl text-foreground">Añadir Nuevo Gasto</DialogTitle>
                                <DialogDescription>Especifica la descripción exacta para auditorías internas.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleGuardarGasto} className="space-y-4 pt-4">
                                <div className="space-y-1.5"><label className="text-sm font-semibold">Concepto / Proveedor *</label><Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Envases térmicos, Luz" required className="rounded-2xl h-12" /></div>
                                <div className="space-y-1.5"><label className="text-sm font-semibold">Monto ($) *</label><Input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" required className="rounded-2xl h-12" /></div>
                                <div className="flex justify-end pt-4"><Button type="submit" variant="destructive" className="rounded-2xl h-12 px-8" disabled={saving}>Registrar Salida</Button></div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="p-2 rounded-3xl shadow-sm border-border/50 bg-white">
                {loading ? (
                    <div className="space-y-3 p-4"><Skeleton className="h-12 w-full rounded-2xl" /></div>
                ) : (
                    <div className="overflow-hidden rounded-2xl">
                        <Table>
                            <TableHeader className="bg-secondary/20">
                                <TableRow>
                                    <TableHead className="pl-6">Fecha de Registro</TableHead>
                                    <TableHead>Concepto Comercial</TableHead>
                                    <TableHead className="text-right">Monto Neto</TableHead>
                                    <TableHead className="text-center pr-6">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {gastos.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center h-32 text-muted-foreground">No se han registrado salidas de efectivo.</TableCell></TableRow>
                                ) : (
                                    gastos.map((g) => (
                                        <TableRow key={g.id} className="transition-colors hover:bg-secondary/10">
                                            <TableCell className="text-sm text-muted-foreground pl-6">
                                                {new Date(g.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </TableCell>
                                            <TableCell className="font-bold text-foreground">{g.concepto}</TableCell>
                                            <TableCell className="text-right text-destructive font-black text-base">-${g.monto.toFixed(2)} MXN</TableCell>
                                            <TableCell className="text-center pr-6">
                                                <Button variant="ghost" size="sm" onClick={() => handleEliminarGasto(g.id, g.concepto)} className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl">
                                                    <Trash2 size={16} />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </Card>
        </div>
    )
}