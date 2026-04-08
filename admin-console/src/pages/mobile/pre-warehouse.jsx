import { MobileNodeListPage } from 'pages/mobile/node-shared';

export default function MobilePreWarehousePage() {
  return <MobileNodeListPage flowKey="preWarehouse" pathOf={(id) => `/mobile/pre-warehouse/${id}`} />;
}
