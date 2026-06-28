/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import {
    ArrowLeft,
    Users,
    Plus,
    WalletCards,
    CalendarClock,
    CheckCircle2,
    Clock3,
    MessageCircle,
    Copy,
    Trash2,
    Search,
    PackageCheck,
    Sparkles,
    Phone,
    AlertTriangle,
} from 'lucide-react'

type Cliente = {
    id: number
    created_at: string
    nombre: string
    telefono?: string | null
    notas?: string | null
}

type Pedido = {
    id: number
    created_at: string
    cliente_id?: number | null
    cliente_nombre: string
    telefono?: string | null
    detalle: string
    total: number
    anticipo: number
    saldo: number
    fecha_entrega?: string | null
    estado: string
    estado_pago: string
    notas?: string | null
}

type FiltroPedido = 'todos' | 'pendientes' | 'fiados' | 'entregados'

const formatoMoneda = (valor: number) =>
    valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })

const estadoLabel: Record<string, string> = {
    pendiente: 'Pendiente',
    en_proceso: 'En proceso',
    listo: 'Listo',
    entregado: 'Entregado',
}

const pagoLabel: Record<string, string> = {
    pendiente: 'Debe todo',
    parcial: 'Abonó',
    pagado: 'Pagado',
}

const normalizarTelefono = (telefono?: string | null) => (telefono || '').replace(/\D/g, '')

const textoTicketPedido = (pedido: Pedido) => {
    return [
        'Gracias por tu pedido 💕',
        '',
        `Cliente: ${pedido.cliente_nombre}`,
        `Pedido: ${pedido.detalle}`,
        pedido.fecha_entrega ? `Entrega: ${new Date(pedido.fecha_entrega).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}` : null,
        '',
        `Total: ${formatoMoneda(Number(pedido.total))}`,
        `Anticipo: ${formatoMoneda(Number(pedido.anticipo || 0))}`,
        `Resta: ${formatoMoneda(Number(pedido.saldo || 0))}`,
        '',
        '¡Gracias por apoyar mi negocio! ✨',
    ].filter(Boolean).join('\n')
}

export default function PedidosPage() {
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [pedidos, setPedidos] = useState<Pedido[]>([])
    const [loading, setLoading] = useState(true)
    const [openPedido, setOpenPedido] = useState(false)
    const [openCliente, setOpenCliente] = useState(false)
    const [saving, setSaving] = useState(false)
    const [busqueda, setBusqueda] = useState('')
    const [filtro, setFiltro] = useState<FiltroPedido>('pendientes')
    const [tablasListas, setTablasListas] = useState(true)
    const [toast, setToast] = useState({ visible: false, mensaje: '' })

    const [clienteId, setClienteId] = useState('nuevo')
    const [clienteNombre, setClienteNombre] = useState('')
    const [telefono, setTelefono] = useState('')
    const [detalle, setDetalle] = useState('')
    const [total, setTotal] = useState('')
    const [anticipo, setAnticipo] = useState('0')
    const [fechaEntrega, setFechaEntrega] = useState('')
    const [notas, setNotas] = useState('')

    const [nuevoClienteNombre, setNuevoClienteNombre] = useState('')
    const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState('')
    const [nuevoClienteNotas, setNuevoClienteNotas] = useState('')

    const mostrarToast = (mensaje: string) => {
        setToast({ visible: true, mensaje })
        setTimeout(() => setToast({ visible: false, mensaje: '' }), 3200)
    }

    const cargarDatos = async () => {
        setLoading(true)
        const [{ data: clientesData, error: clientesError }, { data: pedidosData, error: pedidosError }] = await Promise.all([
            supabase.from('Clientes').select('*').order('nombre', { ascending: true }),
            supabase.from('Pedidos').select('*').order('created_at', { ascending: false })
        ])

        if (clientesError || pedidosError) {
            console.error(clientesError || pedidosError)
            setTablasListas(false)
            setClientes([])
            setPedidos([])
        } else {
            setTablasListas(true)
            setClientes((clientesData || []) as Cliente[])
            setPedidos((pedidosData || []) as Pedido[])
        }
        setLoading(false)
    }

    useEffect(() => { cargarDatos() }, [])

    const pedidosFiltrados = useMemo(() => {
        const texto = busqueda.toLowerCase()
        return pedidos
            .filter(p => {
                if (filtro === 'pendientes') return p.estado !== 'entregado'
                if (filtro === 'fiados') return p.estado_pago !== 'pagado' && Number(p.saldo || 0) > 0
                if (filtro === 'entregados') return p.estado === 'entregado'
                return true
            })
            .filter(p =>
                p.cliente_nombre.toLowerCase().includes(texto) ||
                (p.telefono || '').includes(texto) ||
                p.detalle.toLowerCase().includes(texto)
            )
    }, [pedidos, filtro, busqueda])

    const resumen = useMemo(() => {
        const pendientes = pedidos.filter(p => p.estado !== 'entregado').length
        const fiado = pedidos.filter(p => p.estado_pago !== 'pagado').reduce((acc, p) => acc + Number(p.saldo || 0), 0)
        const totalEnPedidos = pedidos.reduce((acc, p) => acc + Number(p.total || 0), 0)
        const hoy = new Date()
        const entregasHoy = pedidos.filter(p => {
            if (!p.fecha_entrega || p.estado === 'entregado') return false
            const f = new Date(p.fecha_entrega)
            return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth() && f.getDate() === hoy.getDate()
        }).length
        return { pendientes, fiado, totalEnPedidos, entregasHoy }
    }, [pedidos])

    const limpiarPedido = () => {
        setClienteId('nuevo')
        setClienteNombre('')
        setTelefono('')
        setDetalle('')
        setTotal('')
        setAnticipo('0')
        setFechaEntrega('')
        setNotas('')
    }

    const handleClienteSelect = (value: string) => {
        setClienteId(value)
        if (value === 'nuevo') {
            setClienteNombre('')
            setTelefono('')
            return
        }
        const cliente = clientes.find(c => c.id === Number(value))
        if (cliente) {
            setClienteNombre(cliente.nombre)
            setTelefono(cliente.telefono || '')
        }
    }

    const guardarClienteRapido = async (nombre: string, tel: string, notasCliente = '') => {
        const { data, error } = await supabase
            .from('Clientes')
            .insert([{ nombre, telefono: tel || null, notas: notasCliente || null }])
            .select('*')
            .single()

        if (error) throw error
        return data as Cliente
    }

    const handleGuardarCliente = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!nuevoClienteNombre.trim()) return
        setSaving(true)
        try {
            await guardarClienteRapido(nuevoClienteNombre.trim(), nuevoClienteTelefono.trim(), nuevoClienteNotas.trim())
            setNuevoClienteNombre('')
            setNuevoClienteTelefono('')
            setNuevoClienteNotas('')
            setOpenCliente(false)
            await cargarDatos()
            mostrarToast('👤 Cliente guardado.')
        } catch (error) {
            console.error(error)
            setTablasListas(false)
            mostrarToast('⚠️ Ejecuta el SQL nuevo para activar clientes.')
        }
        setSaving(false)
    }

    const handleGuardarPedido = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!clienteNombre.trim() || !detalle.trim() || !total) return
        setSaving(true)

        try {
            let clienteFinalId: number | null = clienteId !== 'nuevo' ? Number(clienteId) : null
            if (!clienteFinalId) {
                const existente = clientes.find(c => c.nombre.toLowerCase() === clienteNombre.trim().toLowerCase() && (c.telefono || '') === telefono.trim())
                if (existente) clienteFinalId = existente.id
                else {
                    const nuevo = await guardarClienteRapido(clienteNombre.trim(), telefono.trim())
                    clienteFinalId = nuevo.id
                }
            }

            const totalPedido = Number(total)
            const anticipoPedido = Math.min(Number(anticipo || 0), totalPedido)
            const saldo = Math.max(totalPedido - anticipoPedido, 0)
            const estadoPago = saldo <= 0 ? 'pagado' : anticipoPedido > 0 ? 'parcial' : 'pendiente'

            const payload = {
                cliente_id: clienteFinalId,
                cliente_nombre: clienteNombre.trim(),
                telefono: telefono.trim() || null,
                detalle: detalle.trim(),
                total: totalPedido,
                anticipo: anticipoPedido,
                saldo,
                fecha_entrega: fechaEntrega ? new Date(fechaEntrega).toISOString() : null,
                estado: 'pendiente',
                estado_pago: estadoPago,
                notas: notas.trim() || null,
            }

            const { error } = await supabase.from('Pedidos').insert([payload])
            if (error) throw error

            limpiarPedido()
            setOpenPedido(false)
            await cargarDatos()
            mostrarToast('🧁 Pedido guardado.')
        } catch (error) {
            console.error(error)
            setTablasListas(false)
            mostrarToast('⚠️ Ejecuta el SQL nuevo para activar pedidos.')
        }
        setSaving(false)
    }

    const actualizarPedido = async (pedido: Pedido, cambios: Partial<Pedido>, mensaje: string) => {
        const { error } = await supabase.from('Pedidos').update(cambios).eq('id', pedido.id)
        if (error) {
            console.error(error)
            mostrarToast('❌ No se pudo actualizar el pedido.')
            return
        }
        await cargarDatos()
        mostrarToast(mensaje)
    }

    const marcarPagado = (pedido: Pedido) => {
        actualizarPedido(pedido, { estado_pago: 'pagado', anticipo: Number(pedido.total), saldo: 0 }, '💰 Marcado como pagado.')
    }

    const marcarEntregado = (pedido: Pedido) => {
        actualizarPedido(pedido, { estado: 'entregado' }, '✅ Pedido entregado.')
    }

    const avanzarEstado = (pedido: Pedido) => {
        const siguiente = pedido.estado === 'pendiente' ? 'en_proceso' : pedido.estado === 'en_proceso' ? 'listo' : 'entregado'
        actualizarPedido(pedido, { estado: siguiente }, `📦 Estado: ${estadoLabel[siguiente]}`)
    }

    const eliminarPedido = async (pedido: Pedido) => {
        if (!window.confirm(`¿Eliminar pedido de ${pedido.cliente_nombre}?`)) return
        await supabase.from('Pedidos').delete().eq('id', pedido.id)
        await cargarDatos()
        mostrarToast('🗑️ Pedido eliminado.')
    }

    const copiarTicket = async (pedido: Pedido) => {
        await navigator.clipboard.writeText(textoTicketPedido(pedido))
        mostrarToast('📋 Ticket de pedido copiado.')
    }

    const abrirWhatsApp = (pedido: Pedido) => {
        const texto = encodeURIComponent(textoTicketPedido(pedido))
        const tel = normalizarTelefono(pedido.telefono)
        const url = tel ? `https://wa.me/52${tel}?text=${texto}` : `https://wa.me/?text=${texto}`
        window.open(url, '_blank')
    }

    return (
        <div className="app-shell p-4 sm:p-6 max-w-7xl mx-auto space-y-6 relative animate-in fade-in duration-500">
            <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                <div className="bg-primary text-white px-6 py-4 rounded-2xl shadow-xl font-medium flex items-center gap-3">
                    <CheckCircle2 size={20} /> {toast.mensaje}
                </div>
            </div>

            <Link href="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors font-black bg-white/70 hover:bg-white px-4 py-2.5 rounded-2xl w-fit shadow-sm border border-white/70">
                <ArrowLeft size={18} /> Regresar al panel
            </Link>

            <section className="hero-card rounded-[2rem] p-6 sm:p-8 border border-white/70 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-black text-primary shadow-sm mb-3"><Sparkles size={16} /> Clientes, pedidos y fiados</div>
                        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">Pedidos bonitos y ordenados</h1>
                        <p className="text-muted-foreground mt-2 max-w-2xl">Guarda clientes, pedidos por entregar, anticipos, saldos pendientes y tickets para WhatsApp.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Dialog open={openCliente} onOpenChange={setOpenCliente}>
                            <DialogTrigger asChild><Button variant="secondary" className="rounded-2xl h-12 px-5 font-black bg-white/80 text-primary hover:bg-white"><Users size={17} /> Nuevo cliente</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-[430px] rounded-3xl">
                                <DialogHeader><DialogTitle>Guardar cliente</DialogTitle><DialogDescription>Así podrás encontrarlo más rápido en futuros pedidos.</DialogDescription></DialogHeader>
                                <form onSubmit={handleGuardarCliente} className="space-y-4 pt-4">
                                    <div className="space-y-1.5"><label className="text-sm font-black">Nombre</label><Input value={nuevoClienteNombre} onChange={(e) => setNuevoClienteNombre(e.target.value)} required className="rounded-2xl h-12" /></div>
                                    <div className="space-y-1.5"><label className="text-sm font-black">Teléfono</label><Input value={nuevoClienteTelefono} onChange={(e) => setNuevoClienteTelefono(e.target.value)} className="rounded-2xl h-12" /></div>
                                    <div className="space-y-1.5"><label className="text-sm font-black">Notas</label><Input value={nuevoClienteNotas} onChange={(e) => setNuevoClienteNotas(e.target.value)} className="rounded-2xl h-12" /></div>
                                    <Button disabled={saving} className="w-full rounded-2xl h-12 font-black">{saving ? 'Guardando...' : 'Guardar cliente'}</Button>
                                </form>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={openPedido} onOpenChange={(open) => { setOpenPedido(open); if (!open) limpiarPedido() }}>
                            <DialogTrigger asChild><Button className="rounded-2xl h-12 px-5 font-black"><Plus size={17} /> Nuevo pedido</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-[560px] rounded-3xl max-h-[92vh] overflow-y-auto">
                                <DialogHeader><DialogTitle>Nuevo pedido</DialogTitle><DialogDescription>Registra el total, anticipo y fecha de entrega.</DialogDescription></DialogHeader>
                                <form onSubmit={handleGuardarPedido} className="space-y-4 pt-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-black">Cliente guardado</label>
                                        <select value={clienteId} onChange={(e) => handleClienteSelect(e.target.value)} className="w-full h-12 px-4 rounded-2xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50 font-semibold">
                                            <option value="nuevo">Nuevo / escribir manualmente</option>
                                            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre} {c.telefono ? `· ${c.telefono}` : ''}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5"><label className="text-sm font-black">Nombre</label><Input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} required className="rounded-2xl h-12" /></div>
                                        <div className="space-y-1.5"><label className="text-sm font-black">WhatsApp</label><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="rounded-2xl h-12" /></div>
                                    </div>
                                    <div className="space-y-1.5"><label className="text-sm font-black">Pedido</label><Input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej. 12 mochis mixtos" required className="rounded-2xl h-12" /></div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="space-y-1.5"><label className="text-sm font-black">Total</label><Input type="number" step="0.01" min="0" value={total} onChange={(e) => setTotal(e.target.value)} required className="rounded-2xl h-12" /></div>
                                        <div className="space-y-1.5"><label className="text-sm font-black">Anticipo</label><Input type="number" step="0.01" min="0" value={anticipo} onChange={(e) => setAnticipo(e.target.value)} className="rounded-2xl h-12" /></div>
                                        <div className="space-y-1.5"><label className="text-sm font-black">Entrega</label><Input type="datetime-local" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="rounded-2xl h-12" /></div>
                                    </div>
                                    <div className="space-y-1.5"><label className="text-sm font-black">Notas</label><Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Color, dirección, detalles..." className="rounded-2xl h-12" /></div>
                                    <Button disabled={saving} className="w-full rounded-2xl h-12 font-black">{saving ? 'Guardando...' : 'Guardar pedido'}</Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </section>

            {!tablasListas && (
                <Card className="p-5 rounded-3xl border-amber-200 bg-amber-50 text-amber-800 flex items-start gap-3">
                    <AlertTriangle className="mt-0.5" />
                    <div>
                        <p className="font-black">Falta ejecutar el SQL nuevo en Supabase.</p>
                        <p className="text-sm mt-1">Abre `supabase-mejoras.sql`, cópialo en Supabase SQL Editor y ejecútalo una vez para crear Clientes y Pedidos.</p>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <Card className="metric-card p-5 rounded-3xl"><div className="flex gap-3 items-center mb-2"><Clock3 className="text-primary" /><p className="text-sm font-black text-muted-foreground">Pedidos activos</p></div><p className="text-3xl font-black text-primary">{resumen.pendientes}</p></Card>
                <Card className="metric-card p-5 rounded-3xl"><div className="flex gap-3 items-center mb-2"><WalletCards className="text-amber-600" /><p className="text-sm font-black text-muted-foreground">Me deben</p></div><p className="text-3xl font-black text-amber-600">{formatoMoneda(resumen.fiado)}</p></Card>
                <Card className="metric-card p-5 rounded-3xl"><div className="flex gap-3 items-center mb-2"><CalendarClock className="text-green-600" /><p className="text-sm font-black text-muted-foreground">Entregas hoy</p></div><p className="text-3xl font-black text-green-600">{resumen.entregasHoy}</p></Card>
                <Card className="metric-card p-5 rounded-3xl"><div className="flex gap-3 items-center mb-2"><PackageCheck className="text-primary" /><p className="text-sm font-black text-muted-foreground">Total pedidos</p></div><p className="text-3xl font-black text-primary">{formatoMoneda(resumen.totalEnPedidos)}</p></Card>
            </div>

            <Card className="soft-card p-5 rounded-3xl">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/50" size={18} />
                        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cliente, teléfono o pedido..." className="pl-10 h-12 rounded-2xl bg-white/70 border-white focus-visible:ring-primary/30" />
                    </div>
                    <select value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroPedido)} className="h-12 px-4 rounded-2xl border border-input bg-background text-sm outline-none focus:ring-2 focus:ring-primary/50 font-black">
                        <option value="pendientes">Pendientes</option>
                        <option value="fiados">Me deben</option>
                        <option value="entregados">Entregados</option>
                        <option value="todos">Todos</option>
                    </select>
                </div>
            </Card>

            {loading ? (
                <div className="space-y-3"><Skeleton className="h-32 rounded-3xl" /><Skeleton className="h-32 rounded-3xl" /></div>
            ) : pedidosFiltrados.length === 0 ? (
                <Card className="soft-card p-10 rounded-3xl text-center text-muted-foreground">
                    <Users className="mx-auto mb-3 opacity-40" size={44} />
                    <p className="font-black">No hay pedidos en este filtro.</p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {pedidosFiltrados.map((pedido) => (
                        <Card key={pedido.id} className="soft-card p-5 rounded-3xl space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-black text-foreground">{pedido.cliente_nombre}</h2>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Phone size={14} /> {pedido.telefono || 'Sin teléfono'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="text-xs font-black rounded-full bg-primary/10 text-primary px-3 py-1">{estadoLabel[pedido.estado] || pedido.estado}</span>
                                    <span className={`text-xs font-black rounded-full px-3 py-1 ${pedido.estado_pago === 'pagado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{pagoLabel[pedido.estado_pago] || pedido.estado_pago}</span>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-secondary/30 p-4">
                                <p className="font-bold text-foreground">{pedido.detalle}</p>
                                {pedido.notas && <p className="text-sm text-muted-foreground mt-1">{pedido.notas}</p>}
                                {pedido.fecha_entrega && <p className="text-sm font-black text-primary mt-2">Entrega: {new Date(pedido.fecha_entrega).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-2xl bg-primary/10 p-3"><p className="text-xs font-black text-muted-foreground">Total</p><p className="font-black text-primary">{formatoMoneda(Number(pedido.total))}</p></div>
                                <div className="rounded-2xl bg-green-50 p-3"><p className="text-xs font-black text-muted-foreground">Anticipo</p><p className="font-black text-green-600">{formatoMoneda(Number(pedido.anticipo || 0))}</p></div>
                                <div className="rounded-2xl bg-amber-50 p-3"><p className="text-xs font-black text-muted-foreground">Resta</p><p className="font-black text-amber-600">{formatoMoneda(Number(pedido.saldo || 0))}</p></div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <Button variant="secondary" onClick={() => avanzarEstado(pedido)} className="rounded-2xl font-black bg-secondary/70 text-primary">Estado</Button>
                                <Button variant="secondary" onClick={() => marcarPagado(pedido)} disabled={pedido.estado_pago === 'pagado'} className="rounded-2xl font-black bg-green-50 text-green-700 hover:bg-green-100">Pagado</Button>
                                <Button variant="secondary" onClick={() => copiarTicket(pedido)} className="rounded-2xl font-black"><Copy size={15} /> Copiar</Button>
                                <Button onClick={() => abrirWhatsApp(pedido)} className="rounded-2xl font-black"><MessageCircle size={15} /> WhatsApp</Button>
                            </div>

                            <div className="flex justify-between items-center border-t border-border/40 pt-3">
                                <Button variant="ghost" onClick={() => marcarEntregado(pedido)} disabled={pedido.estado === 'entregado'} className="rounded-2xl text-green-700 hover:bg-green-50 font-black">Entregado</Button>
                                <Button variant="ghost" onClick={() => eliminarPedido(pedido)} className="rounded-2xl text-destructive hover:bg-destructive/10 font-black"><Trash2 size={16} /></Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
