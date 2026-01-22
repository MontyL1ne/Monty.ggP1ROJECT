using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;

namespace WebApplication2.Services
{
    public class PostStreamService
    {
        private readonly ConcurrentDictionary<Guid, Channel<string>> _clients = new();

        public (Guid Id, ChannelReader<string> Reader) RegisterClient()
        {
            var id = Guid.NewGuid();
            var channel = Channel.CreateUnbounded<string>();
            _clients[id] = channel;
            return (id, channel.Reader);
        }

        public void UnregisterClient(Guid id)
        {
            if (_clients.TryRemove(id, out var channel))
            {
                channel.Writer.TryComplete();
            }
        }

        public async Task BroadcastAsync(object payload)
        {
            var json = JsonSerializer.Serialize(payload);

            foreach (var kvp in _clients)
            {
                try
                {
                    await kvp.Value.Writer.WriteAsync(json);
                }
                catch
                {
                }
            }
        }
    }
}
