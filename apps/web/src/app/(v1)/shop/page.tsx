import { redirect } from 'next/navigation';

/**
 * Gamla shop-sidan är skrotad — funktioner & köp bor i väsk-knappen på kartan.
 * Gamla länkar landar mjukt på kartan i stället för 404.
 */
export default function ShopPage() {
    redirect('/');
}
