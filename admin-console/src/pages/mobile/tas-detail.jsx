import { useParams } from 'react-router-dom';

import { V14MobileDetailPage } from 'pages/mobile/v14-execution-shared';

export default function MobileTasDetailPage() {
  const { receiptId } = useParams();
  return <V14MobileDetailPage kind="tas" itemId={receiptId} />;
}
