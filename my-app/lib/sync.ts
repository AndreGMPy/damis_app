import { supabase } from './supabase';

type ItemPendiente = {
    producto_id?: number | null;
    cantidad: number;
    subtotal: number;
    costo_total?: number;
    ganancia?: number;
    nombre?: string;
    concepto?: string;
    tipo?: string;
    libre?: boolean;
};

type TicketPendiente = {
    id_local: number;
    fecha: string;
    items: ItemPendiente[];
};

const insertarVentas = async (ticket: TicketPendiente) => {
    const nuevasVentas = ticket.items.map((item) => ({
        producto_id: item.producto_id || null,
        cantidad: item.cantidad,
        total: item.subtotal,
        costo_total: Number(item.costo_total || 0),
        ganancia: Number(item.ganancia ?? (Number(item.subtotal || 0) - Number(item.costo_total || 0))),
        created_at: ticket.fecha,
        tipo: item.producto_id ? 'producto' : (item.tipo || 'libre'),
        concepto: item.concepto || item.nombre || (item.producto_id ? 'Venta de producto' : 'Ingreso libre'),
    }));

    const { error } = await supabase.from('Ventas').insert(nuevasVentas);
    if (!error) return null;

    const fallbackVentas = ticket.items.map((item) => ({
        producto_id: item.producto_id || null,
        cantidad: item.cantidad,
        total: item.subtotal,
        created_at: ticket.fecha,
        tipo: item.producto_id ? 'producto' : (item.tipo || 'libre'),
        concepto: item.concepto || item.nombre || (item.producto_id ? 'Venta de producto' : 'Ingreso libre'),
    }));

    const { error: fallbackError } = await supabase.from('Ventas').insert(fallbackVentas);
    return fallbackError || error;
};

export const sincronizarVentasOffline = async () => {
    const pendientes: TicketPendiente[] = JSON.parse(localStorage.getItem('ventas_pendientes') || '[]');

    if (pendientes.length === 0) return { success: true, message: 'Todo está al día.' };

    try {
        for (const ticket of pendientes) {
            const error = await insertarVentas(ticket);
            if (error) throw error;

            for (const item of ticket.items) {
                if (!item.producto_id) continue;

                const { data: prod } = await supabase
                    .from('Inventario')
                    .select('stock')
                    .eq('id', item.producto_id)
                    .single();

                if (prod) {
                    await supabase
                        .from('Inventario')
                        .update({ stock: Number(prod.stock) - Number(item.cantidad) })
                        .eq('id', item.producto_id);
                }
            }
        }

        localStorage.removeItem('ventas_pendientes');
        return { success: true, message: `✨ ¡Se subieron ${pendientes.length} tickets a la nube!` };
    } catch (error) {
        console.error('Error sincronizando:', error);
        return { success: false, message: '❌ Error al sincronizar. Ejecuta el SQL nuevo o revisa conexión.' };
    }
};
