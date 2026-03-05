import xarray as xr
import glob
import numpy as np

files = sorted(glob.glob('data/openmars/*.nc'))
print(f'找到 {len(files)} 个文件')

ds = xr.open_dataset(files[0])
print(f'=== 文件: {files[0]}')
print(f'变量列表: {list(ds.data_vars)}')

o3 = ds['o3col']
print(f'o3col 维度: {o3.dims}')
print(f'o3col shape: {o3.shape}')
print(f'  min  = {float(o3.min()):.6f}')
print(f'  max  = {float(o3.max()):.6f}')
print(f'  mean = {float(o3.mean()):.6f}')

if 'lev' in o3.dims:
    print('有 lev 维度!')
    lev_dim = "lev"
    for i in range(min(5, len(ds['lev']))):
        layer = o3.isel(lev=i)
        print(f'  lev[{i}] = {float(ds.lev[i]):.4f}, max = {float(layer.max()):.6f}')
    print(f'  对 lev 求 mean 后 max = {float(o3.mean(dim=lev_dim).max()):.6f}')
    print(f'  对 lev 求 sum  后 max = {float(o3.sum(dim=lev_dim).max()):.6f}')
    print(f'  取 lev[0] 后 max      = {float(o3.isel(lev=0).max()):.6f}')
else:
    print('无 lev 维度')

ds.close()