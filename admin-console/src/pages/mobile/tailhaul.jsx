import { MobileNodeListPage } from 'pages/mobile/node-shared';

export default function MobileTailhaulPage() {
  return <MobileNodeListPage flowKey="tailhaul" pathOf={(id) => `/mobile/tailhaul/${id}`} />;
}
