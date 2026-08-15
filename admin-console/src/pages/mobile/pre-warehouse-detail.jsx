import { useParams } from 'react-router-dom';

import { V14MobileDetailPage } from 'pages/mobile/v14-execution-shared';

export default function MobilePreWarehouseDetailPage() {
  const { batchId } = useParams();
  return <V14MobileDetailPage kind="prewarehouse" itemId={batchId} />;
}
