import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { fileCenterRows } from 'data/sinoport';

export default function StationFilesPage() {
  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="File Center"
          title="文件中心"
          description="统一管理 FFM、UWS、Manifest、主单、NOA、POD 等文件，所有文件必须能回连到 Flight / AWB / Truck / POD。"
          chips={['Versioning', 'Preview', 'Traceability']}
        />
      </Grid>

      <Grid size={12}>
        <MainCard title="文件台账">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>类型</TableCell>
                <TableCell>文件名</TableCell>
                <TableCell>关联对象</TableCell>
                <TableCell>版本</TableCell>
                <TableCell>更新时间</TableCell>
                <TableCell>状态</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fileCenterRows.map((item) => (
                <TableRow key={item.name} hover>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.linkedTo}</TableCell>
                  <TableCell>{item.version}</TableCell>
                  <TableCell>{item.updatedAt}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>
    </Grid>
  );
}
