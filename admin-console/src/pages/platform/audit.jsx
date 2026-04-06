import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { auditEvents } from 'data/sinoport';

export default function PlatformAuditPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Audit Center"
          title="审计中心"
          description="平台与货站的关键动作都应在这里可追溯，包括货站创建、规则修改、文件导入、POD 上传和状态回退。"
          chips={['Event Trail', 'File Imports', 'State Changes']}
        />
      </Grid>

      <Grid size={12}>
        <MainCard title="关键审计事件">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>时间</TableCell>
                <TableCell>操作人</TableCell>
                <TableCell>动作</TableCell>
                <TableCell>对象</TableCell>
                <TableCell>结果</TableCell>
                <TableCell>备注</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {auditEvents.map((item) => (
                <TableRow key={`${item.time}-${item.object}`} hover>
                  <TableCell>{item.time}</TableCell>
                  <TableCell>{item.actor}</TableCell>
                  <TableCell>{item.action}</TableCell>
                  <TableCell>{item.object}</TableCell>
                  <TableCell>
                    <StatusChip label={item.result} />
                  </TableCell>
                  <TableCell>{item.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
