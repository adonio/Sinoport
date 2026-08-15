import { useParams } from 'react-router-dom';

import { V14MobileDetailPage } from 'pages/mobile/v14-execution-shared';

export default function MobileBorderDetailPage() {
  const { borderId } = useParams();
  return <V14MobileDetailPage kind="border" itemId={borderId} />;
}
