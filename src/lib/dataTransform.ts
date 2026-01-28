import { FileMetadata } from "../store/useStore";

export type CategoryType = 'Images' | 'Videos' | 'Documents' | 'Archives' | 'Others';

export interface CategoryData {
    name: CategoryType;
    files: FileMetadata[];
    totalSize: number;
    count: number;
}

export interface FolderData {
    folderPath: string;
    totalSize: number;
    duplicateSets: {
        hash: string;
        files: FileMetadata[];
    }[];
}

export const transformToCategories = (groups: FileMetadata[][]): CategoryData[] => {
    const categories: Record<CategoryType, { files: FileMetadata[], totalSize: number, count: number }> = {
        Images: { files: [], totalSize: 0, count: 0 },
        Videos: { files: [], totalSize: 0, count: 0 },
        Documents: { files: [], totalSize: 0, count: 0 },
        Archives: { files: [], totalSize: 0, count: 0 },
        Others: { files: [], totalSize: 0, count: 0 },
    };

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'];
    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv'];
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'xls', 'xlsx', 'ppt', 'pptx'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'iso', 'dmg'];

    groups.forEach(cluster => {
        cluster.forEach(file => {
            const ext = file.path.split('.').pop()?.toLowerCase() || "";
            let category: CategoryType = 'Others';

            if (imageExts.includes(ext)) category = 'Images';
            else if (videoExts.includes(ext)) category = 'Videos';
            else if (docExts.includes(ext)) category = 'Documents';
            else if (archiveExts.includes(ext)) category = 'Archives';

            categories[category].files.push(file);
            categories[category].totalSize += file.size;
            categories[category].count++;
        });
    });

    return Object.entries(categories)
        .filter(([_, data]) => data.count > 0)
        .map(([name, data]) => ({
            name: name as CategoryType,
            ...data,
            files: data.files.sort((a, b) => b.size - a.size)
        }))
        .sort((a, b) => b.totalSize - a.totalSize);
};

export const transformToFolders = (groups: FileMetadata[][]): FolderData[] => {
    const folderMap = new Map<string, FolderData>();

    groups.forEach((group, groupIndex) => {
        const clusterId = `cluster-${groupIndex}`;
        group.forEach(file => {
            const parentDir = file.path.split('/').slice(0, -1).join('/') || "/";
            if (!folderMap.has(parentDir)) {
                folderMap.set(parentDir, {
                    folderPath: parentDir,
                    totalSize: 0,
                    duplicateSets: []
                });
            }
            const folderEntry = folderMap.get(parentDir)!;
            let setEntry = folderEntry.duplicateSets.find(s => s.hash === clusterId);
            if (!setEntry) {
                setEntry = { hash: clusterId, files: [] };
                folderEntry.duplicateSets.push(setEntry);
            }
            if (!setEntry.files.some(f => f.path === file.path)) {
                setEntry.files.push(file);
                folderEntry.totalSize += file.size;
            }
        });
    });

    return Array.from(folderMap.values())
        .map(folder => ({
            ...folder,
            duplicateSets: folder.duplicateSets.filter(set => set.files.length > 1)
        }))
        .filter(folder => folder.duplicateSets.length > 0)
        .sort((a, b) => b.totalSize - a.totalSize);
};
