const firebase = require("firebase/app");
require("firebase/auth");
require("firebase/firestore");
require('dotenv').config()
const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;

const firebaseConfig = {
    apiKey: process.env.FS_API_KEY,
    authDomain: process.env.FS_AUTH_DOMAIN,
    databaseURL: process.env.FS_DATABASE_URL,
    projectId: process.env.FS_PROJECT_ID,
};
firebase.initializeApp(firebaseConfig);

const BRANCH_PATH = `customers/${process.env.CUSTOMER_ID}/branches/${process.env.BRANCH_ID}`
const RESOURCE_PATH = `${BRANCH_PATH}/messegeQeue/msg`

const ORDER_TYPE = "ORDER"
const RECEIPT_TYPE = "RECEIPT"

async function init() {
    console.log('init thermal printer.')
    try {
        await signIn()
        listenResource()

    } catch (error) {
        console.error(error)
    }
}

async function signIn() {
    try {
        let res = await firebase.auth().signInWithEmailAndPassword(
            process.env.CUSTOMER_EMAIL,
            process.env.CUSTOMER_PASSWORD
        );
        // console.log('signed in successfully.', res.email)
    } catch (error) {
        console.error('Could not be signed in')
        return error
    }
}

function listenResource() {

    console.log('start listening resource');
    firebase.firestore()
        .doc(RESOURCE_PATH)
        // .orderBy('name', 'asc')
        .onSnapshot(docSnapshot => {
            // console.log('docSnapshot', docSnapshot.data());
            let data = docSnapshot.data()

            print(data)
        }, err => {
            console.log(err);
        })
}

async function print(data) {
    // console.log("TCP ADDRESS: ", data.TCP_ADDRESS)

    let printers = []
    data.SELECTED_PRINTERS.forEach(function (item) {
        let printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: item.TCP_ADDRESS,
            characterSet: 'PC857_TURKISH',
        });
        console.log('created printer ')
        printer.DETAILS = item
        // console.log('printer with details', printer.DETAILS)
        printers.push(printer)
    })

    if (data.TYPE === RECEIPT_TYPE) {
        console.log('printing with new printer recipet')
        let printer = printers.find(function (p) {
            return p.DETAILS.roles.RECEIPT === true
        })

        if (!printer) {
            console.log('no printer')
            return
        }

        try {

            // printer.beep(); // Sound internal beeper/buzzer (if available)
        } catch (error) {
            console.error(error)
        }


        printer.println(data.OUTPUT)
        printer.cut();



        try {
            await printer.execute();
            // printer.beep(); // Sound internal beeper/buzzer (if available)
            console.log("Print done receipt, bar!i with new");
        } catch (error) {
            console.log("Print failed with new:", error);
        }


    }

}

init()