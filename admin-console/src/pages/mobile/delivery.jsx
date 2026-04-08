import { MobileNodeListPage } from 'pages/mobile/node-shared';

export default function MobileDeliveryPage() {
  return <MobileNodeListPage flowKey="delivery" pathOf={(id) => `/mobile/delivery/${id}`} />;
}
