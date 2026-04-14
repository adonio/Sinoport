import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { useGetPlatformStations } from 'api/platform';

export default function PlatformStationsPage() {
  const { stationCatalog } = useGetPlatformStations();

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Station & Resource Registry"
          title="货站与资源管理"
          description="平台方在这里维护站点目录、控制层级、服务范围和基础资源入口，为后续班组、区位、设备与站点能力矩阵预留统一基线。"
          chips={['Station Directory', 'Control Level', 'Service Scope', 'Resource Entry']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/stations/capabilities" variant="outlined">
                能力矩阵
              </Button>
              <Button component={RouterLink} to="/platform/stations/teams" variant="outlined">
                班组映射
              </Button>
              <Button component={RouterLink} to="/platform/stations/zones" variant="outlined">
                区位映射
              </Button>
              <Button component={RouterLink} to="/platform/stations/devices" variant="outlined">
                设备映射
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <MainCard title="货站台账">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>货站编码</TableCell>
                <TableCell>区域</TableCell>
                <TableCell>控制层级</TableCell>
                <TableCell>阶段</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stationCatalog.map((station) => (
                <TableRow key={station.code} hover>
                  <TableCell>
                    <Stack>
                      <Typography variant="subtitle2">{station.code}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {station.name}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>{station.region}</TableCell>
                  <TableCell>
                    <StatusChip label={station.control} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={station.phase} />
                  </TableCell>
                  <TableCell>{station.owner}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to="/station/dashboard" size="small" variant="outlined">
                      进入货站系统
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <MainCard title="新增货站" subheader="当前阶段只做前端 demo，先冻结站点主数据和服务范围字段">
          <Stack sx={{ gap: 2 }}>
            <TextField label="货站名称" value="RZE 东欧入口站" />
            <TextField label="货站编码" value="RZE" />
            <TextField label="机场代码" value="RZE / EPRZ" />
            <TextField select label="控制层级" value="协同控制">
              <MenuItem value="强控制">强控制</MenuItem>
              <MenuItem value="协同控制">协同控制</MenuItem>
              <MenuItem value="接口可视">接口可视</MenuItem>
            </TextField>
            <TextField label="服务范围" value="进港 handling / 卡车协同 / NOA / POD" multiline minRows={3} />
            <TextField label="默认 Owner" value="Expansion Team" />
            <Button variant="contained">创建站点租户</Button>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
