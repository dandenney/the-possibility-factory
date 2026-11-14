import Darwin
import Foundation

/// Answers `native.later` with every process this user may read, one `<KB> <path>` line each
/// (`ps -axo rss=,comm=`'s form), its memory the footprint Activity Monitor shows, and the
/// names of the bundles that ship Electron Framework.
final class ProcessScan: ExactModule {
    override func later(_ request: [String: Any], reply: ExactReply) {
        DispatchQueue.global(qos: .userInitiated).async {
            let (lines, electron) = ProcessScan.scan()
            reply.send([
                "text": lines.joined(separator: "\n"),
                "electronApps": electron.joined(separator: "\n"),
                "error": lines.isEmpty ? "No processes could be read." : "",
            ])
        }
    }

    static func scan() -> ([String], [String]) {
        let capacity = proc_listallpids(nil, 0)
        guard capacity > 0 else { return ([], []) }
        var pids = [pid_t](repeating: 0, count: Int(capacity) + 64)
        let count = pids.withUnsafeMutableBufferPointer { buffer in
            proc_listallpids(buffer.baseAddress, Int32(buffer.count * MemoryLayout<pid_t>.size))
        }
        var lines: [String] = []
        var seen = Set<String>()
        var electron: [String] = []
        var path = [CChar](repeating: 0, count: 4 * Int(MAXPATHLEN))
        for pid in pids.prefix(Int(max(count, 0))) where pid > 0 {
            guard proc_pidpath(pid, &path, UInt32(path.count)) > 0 else { continue }
            var usage = rusage_info_v4()
            let read = withUnsafeMutablePointer(to: &usage) { pointer in
                pointer.withMemoryRebound(to: rusage_info_t?.self, capacity: 1) {
                    proc_pid_rusage(pid, RUSAGE_INFO_V4, $0)
                }
            }
            guard read == 0 else { continue }
            let executable = String(cString: path)
            lines.append("\(usage.ri_phys_footprint / 1024) \(executable)")
            if let end = executable.range(of: ".app/") {
                let bundle = String(executable[..<end.lowerBound]) + ".app"
                if seen.insert(bundle).inserted,
                   FileManager.default.fileExists(atPath: bundle + "/Contents/Frameworks/Electron Framework.framework") {
                    electron.append(((bundle as NSString).lastPathComponent as NSString).deletingPathExtension)
                }
            }
        }
        return (lines, electron)
    }
}

let exactModule: ExactModule.Type = ProcessScan.self
