/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ArrowLeft, Trash2, ReceiptText, Repeat2, PlusCircle, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'

interface Gasto {
    id: number
    created_at: string
    concepto: string
    monto: number
}

interface GastoRecurrente {
    id: number | string
    created_at?: string
    concepto: string
    monto: number
    categoria?: string
    activo?: boolean
    local?: boolean
}

const formatoMoneda = (valor: number) =>
    valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

export default function GastosPage() {
    const [gastos, setGastos] = useState<Gasto[]>([])
    const [recurrentes, setRecurrentes] = useState<GastoRecurrente[]>([])
    const [loading, setLoading] = useState(true)
    const [open, setOpen] = useState(false)
    const [openRecurrente, setOpenRecurrente] = useState(false)

    const [concepto, setConcepto] = useState('')
    const [monto, setMonto] = useState('')
    const [conceptoRecurrente, setConceptoRecurrente] = useState('')
    const [montoRecurrente, setMontoRecurrente] = useState('')
    const [categoriaRecurrente, setCategoriaRecurrente] = useState('Producción')
    const [saving, setSaving] = useState(false)
    const [savingRecurrente, setSavingRecurrente] = useState(false)
    const [toast, setToast] = useState({ visible: false, mensaje: '' })
    const [modoLocalRecurrentes, setModoLocalRecurrentes] = useState(false)

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

    const cargarRecurrentesLocales = () => {
        const cache = JSON.parse(localStorage.getItem('gastos_recurrentes_cache') || '[]')
        setRecurrentes(cache)
        setModoLocalRecurrentes(true)
    }

    const fetchRecurrentes = async () => {
        const { data, error } = await supabase
            .from('GastosRecurrentes')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) {
            cargarRecurrentesLocales()
            return
        }

        setModoLocalRecurrentes(false)
        setRecurrentes(data || [])
        localStorage.setItem('gastos_recurrentes_cache', JSON.stringify(data || []))
    }

    useEffect(() => {
        fetchGastos()
        fetchRecurrentes()
    }, [])

    const totalGastos = gastos.reduce((acc, curr) => acc + Number(curr.monto), 0)
    const gastoPromedio = gastos.length ? totalGastos / gastos.length : 0

    const gastosMes = useMemo(() => {
        const hoy = new Date()
        return gastos.filter(g => {
            const fecha = new Date(g.created_at)
            return fecha.getFullYear() === hoy.getFullYear() && fecha.getMonth() === hoy.getMonth()
        }).reduce((acc, curr) => acc + Number(curr.monto), 0)
    }, [gastos])

    const limpiarFormularioGasto = () => {
        setConcepto('')
        setMonto('')
    }

    const handleGuardarGasto = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!concepto.trim() || !monto) return
        setSaving(true)

        const { error } = await supabase.from('Gastos').insert([{ concepto: concepto.trim(), monto: parseFloat(monto) }])
        if (error) {
            console.error(error)
            mostrarToast('❌ No se pudo guardar el gasto.')
            setSaving(false)
            return
        }

        limpiarFormularioGasto()
        setOpen(false)
        fetchGastos()
        mostrarToast('💸 Egreso registrado en el balance.')
        setSaving(false)
    }

    const handleGuardarRecurrente = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!conceptoRecurrente.trim() || !montoRecurrente) return
        setSavingRecurrente(true)

        const nuevoRecurrente = {
            concepto: conceptoRecurrente.trim(),
            monto: parseFloat(montoRecurrente),
            categoria: categoriaRecurrente,
            activo: true
        }

        if (modoLocalRecurrentes) {
            const cache = JSON.parse(localStorage.getItem('gastos_recurrentes_cache') || '[]')
            const nuevoLocal = { ...nuevoRecurrente, id: `local-${Date.now()}`, created_at: new Date().toISOString(), local: true }
            const nuevos = [nuevoLocal, ...cache]
            localStorage.setItem('gastos_recurrentes_cache', JSON.stringify(nuevos))
            setRecurrentes(nuevos)
            mostrarToast('📌 Gasto recurrente guardado en este dispositivo.')
        } else {
            const { error } = await supabase.from('GastosRecurrentes').insert([nuevoRecurrente])
            if (error) {
                console.error(error)
                cargarRecurrentesLocales()
                mostrarToast('⚠️ Falta crear GastosRecurrentes en Supabase. Lo guardé localmente.')
                setSavingRecurrente(false)
                return
            }
            await fetchRecurrentes()
            mostrarToast('📌 Gasto recurrente guardado.')
        }

        setConceptoRecurrente('')
        setMontoRecurrente('')
        setCategoriaRecurrente('Producción')
        setOpenRecurrente(false)
        setSavingRecurrente(false)
    }

    const usarRecurrenteComoGasto = async (recurrente: GastoRecurrente) => {
        const { error } = await supabase.from('Gastos').insert([{ concepto: recurrente.concepto, monto: recurrente.monto }])
        if (error) {
            console.error(error)
            mostrarToast('❌ No se pudo registrar este gasto.')
            return
        }
        await fetchGastos()
        mostrarToast(`✅ Se registró: ${recurrente.concepto}`)
    }

    const handleEliminarGasto = async (id: number, conceptoGasto: string) => {
        if (!window.confirm(`¿Eliminar registro de gasto: "${conceptoGasto}"?`)) return
        await supabase.from('Gastos').delete().eq('id', id)
        fetchGastos()
        mostrarToast('🗑️ Gasto eliminado correctamente.')
    }

    const handleEliminarRecurrente = async (recurrente: GastoRecurrente) => {
        if (!window.confirm(`¿Eliminar recurrente: "${recurrente.concepto}"?`)) return

        if (modoLocalRecurrentes || recurrente.local) {
            const nuevos = recurrentes.filter(r => r.id !== recurrente.id)
            localStorage.setItem('gastos_recurrentes_cache', JSON.stringify(nuevos))
            setRecurrentes(nuevos)
            mostrarToast('🗑️ Recurrente eliminado de este dispositivo.')
            return
        }

        await supabase.from('GastosRecurrentes').delete().eq('id', recurrente.id)
        fetchRecurrentes()
        mostrarToast('🗑️ Recurrente eliminado.')
    }

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 relative animate-in fade-in duration-500">
            <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-semibold bg-primary/10 hover:bg-primary/20 px-4 py-2.5 rounded-2xl w-fit">
                <ArrowLeft size={18} /> Regresar al Panel
            </Link>

            <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-primary text-white px-6 py-4 rounded-2xl shadow-xl font-medium flex items-center gap-3">{toast.mensaje}</div>
            </div>

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary">Control de Salidas y Gastos</h1>
                    <p className="text-muted-foreground mt-1">Registra gastos normales y guarda costos recurrentes para usarlos en un toque.</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <Dialog open={openRecurrente} onOpenChange={setOpenRecurrente}>
                        <DialogTrigger asChild>
                            <Button variant="secondary" className="rounded-2xl h-12 px-6 text-primary font-bold flex items-center gap-2">
                                <Repeat2 size={18} /> + Gasto recurrente
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[430px] rounded-3xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl text-foreground">Guardar gasto recurrente</DialogTitle>
                                <DialogDescription>Ej. costo unitario de producción, empaque, etiqueta o insumo fijo.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleGuardarRecurrente} className="space-y-4 pt-4">
                                <div className="space-y-1.5"><label className="text-sm font-semibold">Concepto *</label><Input value={conceptoRecurrente} onChange={(e) => setConceptoRecurrente(e.target.value)} placeholder="Ej. Caja para mochi, etiqueta, envase" required className="rounded-2xl h-12" /></div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1.5"><label className="text-sm font-semibold">Monto unitario *</label><Input type="number" step="0.01" min="0" value={montoRecurrente} onChange={(e) => setMontoRecurrente(e.target.value)} placeholder="0.00" required className="rounded-2xl h-12" /></div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold">Categoría</label>
                                        <select value={categoriaRecurrente} onChange={(e) => setCategoriaRecurrente(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50">
                                            <option>Producción</option>
                                            <option>Empaque</option>
                                            <option>Servicios</option>
                                            <option>Transporte</option>
                                            <option>Otro</option>
                                        </select>
                                    </div>
                                </div>
                                <Button type="submit" className="w-full rounded-2xl h-12 font-bold" disabled={savingRecurrente}>{savingRecurrente ? 'Guardando...' : 'Guardar recurrente'}</Button>
                            </form>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) limpiarFormularioGasto() }}>
                        <DialogTrigger asChild>
                            <Button variant="destructive" className="rounded-2xl h-12 px-6 shadow-md hover:shadow-lg bg-destructive/90 text-white font-bold flex items-center gap-2">
                                <ReceiptText size={18} /> + Registrar Gasto
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] rounded-3xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl text-foreground">Añadir Nuevo Gasto</DialogTitle>
                                <DialogDescription>Registra una salida de dinero única.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleGuardarGasto} className="space-y-4 pt-4">
                                <div className="space-y-1.5"><label className="text-sm font-semibold">Concepto / Proveedor *</label><Input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej. Envases, luz, gasolina" required className="rounded-2xl h-12" /></div>
                                <div className="space-y-1.5"><label className="text-sm font-semibold">Monto ($) *</label><Input type="number" step="0.01" min="0" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" required className="rounded-2xl h-12" /></div>
                                <div className="flex justify-end pt-4"><Button type="submit" variant="destructive" className="rounded-2xl h-12 px-8" disabled={saving}>{saving ? 'Registrando...' : 'Registrar salida'}</Button></div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-5 rounded-3xl border-border/50 bg-white">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Egresos de todos los tiempos</p>
                    <p className="text-3xl font-black text-destructive mt-2">-{formatoMoneda(totalGastos)}</p>
                </Card>
                <Card className="p-5 rounded-3xl border-border/50 bg-white">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Gastos de este mes</p>
                    <p className="text-3xl font-black text-primary mt-2">{formatoMoneda(gastosMes)}</p>
                </Card>
                <Card className="p-5 rounded-3xl border-border/50 bg-white">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Promedio por gasto</p>
                    <p className="text-3xl font-black text-foreground mt-2">{formatoMoneda(gastoPromedio)}</p>
                </Card>
            </div>

            <Card className="p-6 rounded-3xl shadow-sm border-border/50 bg-white">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-xl font-black text-foreground flex items-center gap-2"><ClipboardCheck className="text-primary" size={22} /> Gastos recurrentes guardados</h2>
                        <p className="text-sm text-muted-foreground mt-1">No se descuentan solos; son plantillas para registrar rápido cuando se usen.</p>
                    </div>
                    {modoLocalRecurrentes && <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">Modo local</span>}
                </div>

                {recurrentes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-5 text-sm text-muted-foreground">
                        Guarda aquí costos como “caja individual”, “etiqueta”, “gasolina” o “costo unitario de producción”.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {recurrentes.map((r) => (
                            <div key={r.id} className="rounded-2xl border border-border/60 bg-secondary/20 p-4 space-y-3">
                                <div className="flex justify-between gap-3">
                                    <div>
                                        <p className="font-black text-foreground leading-tight">{r.concepto}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{r.categoria || 'Sin categoría'}</p>
                                    </div>
                                    <p className="font-black text-primary whitespace-nowrap">{formatoMoneda(Number(r.monto))}</p>
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={() => usarRecurrenteComoGasto(r)} className="h-10 rounded-xl flex-1 font-bold"><PlusCircle size={16} /> Usar</Button>
                                    <Button variant="ghost" onClick={() => handleEliminarRecurrente(r)} className="h-10 w-10 p-0 rounded-xl text-destructive hover:bg-destructive/10"><Trash2 size={16} /></Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card className="p-2 rounded-3xl shadow-sm border-border/50 bg-white">
                {loading ? (
                    <div className="space-y-3 p-4"><Skeleton className="h-12 w-full rounded-2xl" /></div>
                ) : (
                    <div className="overflow-x-auto rounded-2xl">
                        <Table>
                            <TableHeader className="bg-secondary/20">
                                <TableRow>
                                    <TableHead className="pl-6">Fecha</TableHead>
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
                                            <TableCell className="text-sm text-muted-foreground pl-6 whitespace-nowrap">
                                                {new Date(g.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </TableCell>
                                            <TableCell className="font-bold text-foreground">{g.concepto}</TableCell>
                                            <TableCell className="text-right text-destructive font-black text-base">-{formatoMoneda(Number(g.monto))}</TableCell>
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
