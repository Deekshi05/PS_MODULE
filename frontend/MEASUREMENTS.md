# Frontend Measurements

PowerShell examples (run from repo root `d:\sem6\psmodule`):

## Total `.jsx` files
```powershell
Get-ChildItem -Recurse -Filter *.jsx frontend\src |
  Measure-Object | Select-Object -ExpandProperty Count
```

## Files inside `Modules/<ModuleName>/components/`
For the `Indent` module:
```powershell
Get-ChildItem -Recurse -Filter *.jsx frontend\src\Modules\Indent\components |
  Measure-Object | Select-Object -ExpandProperty Count
```

## Total frontend lines of code
```powershell
$files = Get-ChildItem -Recurse -Include *.js,*.jsx -File frontend\src
($files | ForEach-Object { (Get-Content $_.FullName).Count } | Measure-Object).Count
```

## Number of axios API calls
The module’s axios calls are centralized in:
`frontend/src/Modules/Indent/api.js`

Count `client.get(` and `client.post(` occurrences:
```powershell
rg "client\.(get|post)\(" frontend\src\Modules\Indent\api.js | Measure-Object
```

