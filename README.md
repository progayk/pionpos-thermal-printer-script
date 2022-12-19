# PIONPOS Thermal Printer Setup

## Create .env file for credentials

```
CUSTOMER_ID=
BRANCH_ID=
CUSTOMER_EMAIL=
CUSTOMER_PASSWORD=

FS_API_KEY=
FS_AUTH_DOMAIN=
FS_DATABASE_URL=
FS_PROJECT_ID=
```

## SETUP FOR PION THERMAL PRINTER (WINDOWS)

- install pm2
- install firebase admin sdk
- install node-thermal-printer

For windows install pm2-windows-startup

```
npm i pm2-windows-startup -g
```

```
npm i pm2 -g
```

- add index.js to pm2

```
pm2 start [path-to-index]
```

Start pm2 on start-up 
```
pm2 startup
```

windows icin start-up
```
pm2-startup install
```

PM2 will now automatically revive the saved processes on startup. To save the current list of processes execute:

```
pm2 save
```

## Setup for Raspberry Pi

- Install os image to SD Card.
- Add empty file to the SD Card by name `ssh`
- Insert SD Card into Raspi.

- After booting the Raspi ssh into it:

```
ssh pi@raspberrypi.local
```

### Configure Raspi

- Enable ssh and change localisation settings from `raspi-config`:

```
sudo raspi-config
```

Update and upgrade:

```
sudo apt-get update && sudo apt-get upgrade
```

### Setup new user

It's generally a good idea to have a different linux user for each app running on your server. To create a new user, for an `api` app for example:

```
sudo useradd -m api -G sudo
sudo passwd api
logout
```

Login with the user and password you just created. After you've confirmed your new user has sudo privelages, you can delete the default `pi` user for good measure:

```
sudo deluser pi
```

### Internal Networking

You can plug your Pi via ethernet cable to your router or setup Wifi.

To connect to Wifi: `sudo nano /etc/wpa_supplicant/wpa_supplicant.conf`. Add the following:

```
network={
ssid="SSID"
psk="WIFI PASSWORD"
}
```

Most wireless routers these days are also DHCP servers, which means by default, you will get a different IP address every time you connect to the network. This isn't ideal, as you'll need to know where to find your server on the network if you're going to route requests to or SSH into it.

To assign Static IP address to your Pi on the internal network:

```
sudo nano /etc/dhcpcd.conf
```

Add the following:
`static ip_address=192.168.1.200/24` de olabilir.

```
interface wlan0

# Desired IP Address. Keep /24
static ip_address=192.168.1.200/24
# IP Address of router
static routers=192.168.0.1
# IP Address of router
static domain_name_servers=192.168.0.1
```

Restart Wifi:

```
sudo ifdown wlan0
sudo ifup wlan0
```

f that is done correctly, you can now connect to your Pi via SSH on the local network. What that means is you can ditch the keyboard and monitor that are plugged into your Pi, and do the rest of the work from your normal dev machine. Woo!

From the terminal on your dev machine (or whatever SSH client you use on Windows), you can run:

```
ssh api@192.168.0.200
```

### Install necessary things for a node server

Install the things

```
sudo apt-get update
sudo apt-get install git nodejs nginx -y
```

Install yarn and pm2 with npm

```
sudo npm install -g yarn pm2
```

#### Configure PM2 Logrotate (optional)

PM2, the process manager that keeps your Node scripts running, outputs great log files. However, without configuration these log files can eat up more and more storage on you Pi. The `pm2-logrotate` module can help with this issue.

```
# Install the module
pm2 install pm2-logrotate
# Keep at most 90 days of logs
pm2 set pm2-logrotate:retain 90
# Gzip old log files to save space
pm2 set pm2-logrotate:compress true
```

#### Tweak Nginx (optional)

By default Nginx will advertise it's exact version number, in the server header and a couple other places. You can stop this behavior by editing the nginx config file:

```
sudo nano /etc/nginx/nginx.conf
```

and ensuring the following line is NOT commented out:

```
server_tokens off;
```

Nginx also ships with a default site that just shows a "Welcome to nginx on Debian!" page. This isn't really useful to us, and since we'll be adding new nginx sites, we can disable this default site. To do so, run:

```
sudo nano /etc/nginx/sites-available/default
```

and add `return 404;` in the line right after the listen directives.

Reload nginx to see our changes:

```
# Test your changes
sudo nginx -t
# If that says OK, reload
sudo service nginx restart
```

### Run your code

If needed, add app config env vars to `.bashrc`

```
sudo nano ~/.bashrc
# export APP_CONFIG_OPTION=foobar
```

Run your code with PM2:

```
pm2 start ~/APP_DIRECTORY/index.js
```

Make sure your app starts up when raspi restarts:

```
pm2 startup
## This command will tell you to run another command as sudo. Do that.
pm2 save
```

If you run into issues with your PM2 not starting on reboot, even after running the above commands, you can add the following cronjob: `crontab -e`

```
@reboot cd ~/APP_DIRECTORY/ && pm2 start index.js
```

Your app should now be available to any computer on your local network. You can visit

[192.168.1.200:3000](192.168.1.200:3000)

and you'll see your app running (where the IP is the static internal IP address you assinged the PI, and the port is port your Node.js code is litening on).

### Proxy requests with nginx (this step hasn't done )

You're node app most likely isn't running on port 80. It turns out it's kind of a pain to get node servers to directly listen on port 80. Enter nginx.

Add new nginx site block:

```
sudo nano /etc/nginx/sites-available/{APP_NAME}
sudo service nginx reload
```

Add the following text:

```
upstream {APP_NAME} {
    server 127.0.0.1:{NODE_APP_PORT};
    keepalive 64;
}

server {
    listen 80;

    server_name {DESIRED_DOMAIN_NAME};

    location / {
        proxy_pass http://{APP_NAME}/;
        proxy_http_version 1.1;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_max_temp_file_size 0;
        proxy_redirect off;
        proxy_read_timeout 240s;
    }
}
```

Enable newly configured site:

```
sudo ln -s /etc/nginx/sites-available/{APP_NAME} /etc/nginx/sites-enabled/
sudo service nginx reload
```

You can edit the hosts file (/etc/hosts) on your dev machine to point your newly added domain name to your Raspberry Pi's static internal IP to test your nginx config.

### Make your web server available from ... the web.

If you don't have a static IP from your internet provider (not sure? Odds are you don't), you'll need to use a Dynamic DNS service.

Head over to [Duck DNS](https://www.duckdns.org/domains). It's free and awesome. Make an account and claim a domain. Follow instructions on [this page](https://www.duckdns.org/install.jsp?tab=linux-cron).

```
mkdir ~/duckdns
cd ~/duckdns
nano duck.sh
```

Add the following line to `duck.sh`

```
echo url="https://www.duckdns.org/update?domains={YOUR_DOMAIN}&token={YOUR_TOKEN}4&ip=" | curl -k -o ~/duckdns/duck.log -K -
```

Make the file executable:

```
chmod 700 duck.sh
```

Run that file every 5 minutes. Edit your crontab (`crontab -e`) and add the following line:

```
*/5 * * * * ~/duckdns/duck.sh >/dev/null 2>&1
```

Test the script:

```
./duck.sh
cat duck.log
```

If it's says `OK`, we good.

### Enable SSL like a boss (optional)

Let's Encrypt makes enabling https free and relatively easy. You're already this deep in. Why stop now? [Link](https://www.linuxbabe.com/linux-server/install-lets-encrypt-free-tlsssl-certificate-nginx-debian-8-server)

```
sudo nano /etc/apt/sources.list
```

and add the following line to the end:

```
deb http://ftp.debian.org/debian jessie-backports main
```

Install the client:

```
sudo apt-get update
sudo apt-get install letsencrypt -t jessie-backports
```
