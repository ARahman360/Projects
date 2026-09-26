# Phone testing on a trusted local network

From the Home Foods directory, stop any existing development server using port 3000, then run:

```powershell
npm run dev:lan
```

This opt-in launcher discovers private IPv4 addresses, prints the phone URLs, starts Next.js on `0.0.0.0:3000`, and permits only those detected hostnames for Next's development assets. The ordinary `npm run dev` command is unchanged. API requests use relative paths and existing same-origin protection remains enabled.

The Wi-Fi address found on 26 September 2026 was **http://192.168.10.146:3000**. This can change; use the launcher's current output. `localhost` on an iPhone points to the phone, not this computer. Both devices must join the same trusted Wi-Fi; guest-network client isolation or a VPN can block access. Keep the computer awake and the server running.

## Windows Firewall

The inspected Wi-Fi connection is categorized **Public** and Windows Firewall is enabled. Do not disable the firewall or broadly allow Node on all networks. If the phone times out despite the server working locally, an administrator can add this temporary, program/port/subnet-scoped rule on a trusted network:

```powershell
$homeFoodsNode = (Get-Command node.exe).Source
New-NetFirewallRule -DisplayName 'Home Foods temporary LAN 3000' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -RemoteAddress LocalSubnet -Program $homeFoodsNode -Profile Public,Private
```

Remove it after testing, especially before joining an untrusted network:

```powershell
Remove-NetFirewallRule -DisplayName 'Home Foods temporary LAN 3000'
```

No firewall change or public tunnel is applied automatically. If connected to unfamiliar/shared Wi-Fi, use a trusted private network instead. No router port forwarding is required.

## iPhone GPS and HTTPS

Ordinary HTTP over a LAN address is not a secure context for iPhone geolocation. Manual address entry and browsing still work. For GPS testing, obtain a development certificate containing the actual computer IP/DNS name, signed by a local CA that you explicitly install and trust on both devices. Keep the CA private key and server private key outside this repository; never transfer private keys to the phone. Then start Next with the trusted certificate:

```powershell
npm run dev -- --hostname 0.0.0.0 --experimental-https --experimental-https-key C:\private-certs\homefoods-key.pem --experimental-https-cert C:\private-certs\homefoods.pem
```

Set `HOMEFOODS_DEV_LAN_HOSTS` for that session to the actual host before this HTTPS command, and use `https://<actual-host>:3000`. Trust setup is a manual device administration step; an untrusted self-signed certificate alone is insufficient. Do not bypass browser certificate warnings. No public exposure is needed.

## Verification boundary

The user confirmed that the URL opens on their iPhone on 26 September 2026. Full iPhone workflows and GPS remain unverified.

A successful request to the computer's own LAN address proves local binding and host handling, not phone reachability through Wi-Fi/firewall. Actual iPhone/Safari connectivity, camera/location permission and certificate trust must be checked on the physical phone. Desktop mobile viewport testing is reported separately.
