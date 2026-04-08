import { Navigate, useParams } from 'react-router-dom';

import { getMobileNodeDetail } from 'data/sinoport-adapters';
import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobilePreWarehouseDetailPage() {
  const { batchId } = useParams();
  if (!getMobileNodeDetail('preWarehouse', batchId)) {
    return <Navigate to="/mobile/pre-warehouse" replace />;
  }
  return <MobileNodeDetailPage flowKey="preWarehouse" itemId={batchId} backPath="/mobile/pre-warehouse" />;
}
