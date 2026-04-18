import { useParams } from 'react-router-dom';

import { MobileNodeDetailPage } from 'pages/mobile/node-shared';

export default function MobileDeliveryDetailPage() {
  const { deliveryId } = useParams();
  return <MobileNodeDetailPage flowKey="delivery" itemId={deliveryId} backPath="/mobile/delivery" />;
}
