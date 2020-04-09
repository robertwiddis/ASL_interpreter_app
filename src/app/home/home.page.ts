import { Component } from '@angular/core';
import { BluetoothSerial } from '@ionic-native/bluetooth-serial/ngx';
import { TextToSpeech } from '@ionic-native/text-to-speech/ngx';
import { ChangeDetectorRef } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import { tensor1d } from '@tensorflow/tfjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
    text = 'Test';
    pairedList: pairedlist;
    listToggle: boolean = false;
    pairedDeviceID: number = 0;
    dataSend: string = "";
    received: string = "";
    oldtext = '';
    recArray;
    calCount = '';
    connected;
    calibrated: boolean = false;
    calibratedstart1: boolean = false;
    calibratedstart2: boolean = false;
    calFinger1 = [];
    calFinger2 = [];
    calFinger3 = [];
    calFinger4 = [];
    linearModel: tf.Sequential;
    prediction: any;
    InputTaken: any;
    movementdata: any;
    datacount: number = 0;
    f: number = 0;
    recdata = [];
    prevword = "";
    calFingerall = [];
   

    constructor(
        private tts: TextToSpeech,
        private bluetooth: BluetoothSerial,
        private cdr: ChangeDetectorRef,
    ) {
        this.text = ''

        this.oldtext = ''
        this.recArray = [];
        this.connected = false;
        this.movementdata = new Array(30);
        
    }

    ionViewDidLoad() {
    }
    

    textToSpeech() { // reads aloud the new prediction set in the this.text variable
        this.tts.speak(this.text)
            .then(() => console.log('Success'))
            .catch((reason: any) => console.log(reason));
    }

    setText(word) { // function used to change the prediction word, also reads aloud the new wordd using above function
        this.text = word;
        if (this.prevword != word) {
            this.textToSpeech();
            this.prevword = word;
        }
        
    }

    checkBLE() {
        this.bluetooth.isEnabled().then(success =>{ // simple check to make sure user has BLe enabled and has enabled app to use it. 
            this.listDevices();
    }, error => {
    alert('ble not enabled')
    })
    }

    listDevices() { // uses native function to get list of all available devices
        this.bluetooth.list().then(success => {
            this.pairedList = success;
            this.listToggle = true;
        }, error => {
            alert("Please Enable Bluetooth")
            this.listToggle = false;
        });
    }
        async startCalib() { // this is the calibration process, variable here "calibstart1 etc." are used by UI to distinguish which elements to show user
            this.calibratedstart1 = true;   // basically records 2 readings then averages them. Gets readings when the pictures are displayed showing action
            this.calCount = '3';
            await this.sleep(1000)
            this.calCount = '2';
            this.calFinger1[0] = parseInt(this.recArray[0]); // Fore finger open Calibration
            this.calFinger2[0] = parseInt(this.recArray[1]); // Middle finger open Calibration
            this.calFinger3[0] = parseInt(this.recArray[2]); // Ring finger open Calibration
            this.calFinger4[0] = parseInt(this.recArray[3]); // Pinky finger open Calibration
            await this.sleep(1000) 
            this.calCount = '1';
            await this.sleep(1000);
            this.calCount = 'done';
            await this.sleep(500);
            //this.calibrated = true;
            this.calibratedstart1 = false;
            this.calibratedstart2 = true;
            this.cdr.detectChanges();
            this.calCount = '3';
            await this.sleep(1500)
            this.calCount = '2';
            var read11 = parseInt(this.recArray[0]) // Fore finger closed 1
            var read12 = parseInt(this.recArray[1]); // Middle finger closed 1
            var read13 = parseInt(this.recArray[2]); // ring finger closed 1
            var read14 = parseInt(this.recArray[4]); // pinky finger closed 1


            await this.sleep(1500)
            this.calCount = '1';
            var read21 = parseInt(this.recArray[0])
            var read22 = parseInt(this.recArray[1]);
            var read23 = parseInt(this.recArray[2]); // ring finger closed 1
            var read24 = parseInt(this.recArray[4]); // pinky finger closed 1
            this.calFinger1[1] = (read11 + read21)/2;
            this.calFinger2[1] = (read12 + read22) / 2;
            this.calFinger3[1] = (read13 + read23) / 2;
            this.calFinger4[1] = (read14 + read24) / 2;
            var calFingerall = [this.calFinger1, this.calFinger2, this.calFinger3, this.calFinger4]
            await this.sleep(1000)
            this.calCount = 'done'
            await this.sleep(500)
            this.calibrated = true;
            this.cdr.detectChanges();
    }
    sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
    }
    getLabel(array) {
        var labels =['four', 'one','three','two'] // labels associated with current model (will need to change in subsequent models)
        if (array[0] != "undefined"){
            for (let f = 0; f <= (array.length); f++) { // parse through the weights array
                if (array[f] > 0.5) { // check each input in the output weights array. since out of 100%, if greater than 50% must be best prediction. 
                    this.setText(labels[f]); // convert this index into array into the label in the labels array at same index. 
                }
            }
        }
    }
    ReadDevice(success) {
        var i = this.datacount
        var recdata = [];
        if (i < 30) {
            this.received = JSON.stringify(success) // this function parses the data into appropraite formats and allows for normalization
            this.received = this.received.replace('"', "")
            this.received = this.received.replace('/n', "")
            this.received = this.received.replace('"', "")
            this.recArray = this.received.split(",");
           
            for (let f = 0; f <= (this.recArray.length - 1); f++) {
                if (this.recArray[f] > 100) {
                    this.recdata.push(((parseInt(this.recArray[f])) / this.calFingerall[f])); // normalize to calfingerall array with max values
                }
                else {
                    this.recdata.push(((parseInt(this.recArray[f])) / 9.81)); // normalize all accelerometer data to 9.81
                }
               
            }
           
            this.datacount = this.datacount + 1; // count for 30 datasets
        }
        if (i >= 30) { // if hit 30 points, make prediction, reset recorded array,
            this.datacount = 0;
            this.movementdata = this.recdata;
            this.makePrediction(this.movementdata);
            this.cdr.detectChanges();
            this.recdata = [];
        }

        else { // initialize and catch state
            this.datacount = 0;
            this.cdr.detectChanges();
            
        }
       // this.received = JSON.stringify(this.bluetooth.readUntil(':)'));
            
    }
        

    
    selectDevice() {
        //call connect function from phone API
        let connectedDevice = this.pairedList[this.pairedDeviceID];
        if (!connectedDevice.address) {
            alert('Select Paired Device to connect');
            return;
        }
        let address = connectedDevice.address;
        let name = connectedDevice.name;

        this.connect(address);
    }

    connect(address) {
        // Connect BLE
        this.bluetooth.connect(address).subscribe(success => {
            this.connected = true;
            this.cdr.detectChanges()
            this.deviceConnected();
            alert("Successfully Connected");
            
        }, error => {
                alert("Error:Connecting to Device");
                this.connected = false;
                console.log(error);
                this.cdr.detectChanges()
        });
    }

    deviceConnected() {
        // Subscribe to data receiving as soon as the delimiter is read
        this.bluetooth.subscribe('/n').subscribe(success => {
            this.ReadDevice(success); // one delimiter is read mening data received, send data received the parse function
            
        }, error => {
            alert(error);
        });
    }

    // Machine Learning Integration code Below

    async makePrediction(data) { // the test function called to make real prediction with new data
        var model = await tf.loadLayersModel('./assets/tfjsmodel/model.json'); // load JSON model stored locally
        var testdata = tf.reshape(data, [1, 210]); // reshape array of data into appropriate format
        var predic = (model.predict(testdata) as tf.Tensor); // define the prediction as a tensorflow type: "tensor"
        await predic.data().then(data => { // model is not instant, the await is to ensure we evaluate on a finished product. will return a promise until done
            this.prediction = JSON.stringify(data); // for tesing
            console.log(this.prediction)     // log prediction to console (this is NOT the label, just the weight function output)
            this.getLabel(data); // use the weight function data to evaluate the actual label of the data
            this.cdr.detectChanges(); // alert the app that the prediction text changed. 
        });

    }
}
interface pairedlist {
    "class": number,
    "id": string,
    "address": string,
    "name": string

}

