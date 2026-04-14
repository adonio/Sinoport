import { useParams } from 'react-router-dom';

import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobilePreWarehouseDetailPage() {
  const { batchId } = useParams();
  return <MobileNodeDetailPage flowKey="preWarehouse" itemId={batchId} backPath="/mobile/pre-warehouse" />;
}
