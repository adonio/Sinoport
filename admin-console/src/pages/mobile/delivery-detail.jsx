import { Navigate, useParams } from 'react-router-dom';

import { getMobileNodeDetail } from 'data/sinoport-adapters';
import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileDeliveryDetailPage() {
  const { deliveryId } = useParams();
  if (!getMobileNodeDetail('delivery', deliveryId)) {
    return <Navigate to="/mobile/delivery" replace />;
  }
  return <MobileNodeDetailPage flowKey="delivery" itemId={deliveryId} backPath="/mobile/delivery" />;
}
