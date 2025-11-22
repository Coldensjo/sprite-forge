import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2 } from 'lucide-react';
import { selectDatFile, selectSprFile, loadTibiaData } from '@/lib/tibia';
import type { TibiaData } from '@/lib/tibia';

export const FileLoader = () => {
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TibiaData | null>(null);

  const handleLoadFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      setProgress(0);

      // Select DAT file
      const datPath = await selectDatFile();
      if (!datPath) {
        setLoading(false);
        return;
      }

      // Select SPR file
      const sprPath = await selectSprFile();
      if (!sprPath) {
        setLoading(false);
        return;
      }

      // Load files
      const tibiaData = await loadTibiaData(datPath, sprPath, undefined, true, (stage, current, total) => {
        setLoadingStage(stage);
        setProgress(Math.round((current / total) * 100));
      });

      setData(tibiaData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Load Tibia Client Files</CardTitle>
        <CardDescription>
          Select Tibia.dat and Tibia.spr files to load sprites and objects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleLoadFiles} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {loadingStage} ({progress}%)
            </>
          ) : (
            'Load Files'
          )}
        </Button>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {data && (
          <div className="space-y-2 text-sm">
            <div className="font-semibold">Loaded Successfully!</div>
            <div className="grid grid-cols-2 gap-2">
              <div>Version:</div>
              <div className="font-mono">{data.version.label}</div>

              <div>Items:</div>
              <div className="font-mono">{data.itemsCount}</div>

              <div>Outfits:</div>
              <div className="font-mono">{data.outfitsCount}</div>

              <div>Effects:</div>
              <div className="font-mono">{data.effectsCount}</div>

              <div>Missiles:</div>
              <div className="font-mono">{data.missilesCount}</div>

              <div>Sprites:</div>
              <div className="font-mono">{data.spritesCount}</div>

              <div>Extended:</div>
              <div className="font-mono">{data.extended ? 'Yes' : 'No'}</div>

              <div>Transparency:</div>
              <div className="font-mono">{data.transparency ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
